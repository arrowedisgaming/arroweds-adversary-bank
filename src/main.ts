import { Editor, Plugin, setTooltip, Menu, Notice, type TFolder, debounce, type Debouncer } from 'obsidian';
import { SettingTab, type PluginSettings, DEFAULT_SETTINGS } from './settings';
import { ADV_LIBRARY, ENV_LIBRARY, ADV_TEMPLATE, ENV_TEMPLATE, walkFolder, tryParseYaml } from './utils';
import { AdversaryCard, AdversaryModal, type RawAdversary } from './ui';

export type PluginState = {
    settings: PluginSettings;
    cards: {
        [id: string]: {
            color?: string;
            count?: number;
            [index: number]: {
                hp?: number;
                stress?: number;
                uses?: { [key: string]: number };
                countdown?: { [key: string]: number };
                conditions?: string[];
                instanceName?: string;
            };
        };
    };
};

export default class BeastVault extends Plugin {
    activeBlocks: Map<AdversaryCard, string> = new Map();
    state: PluginState;
    saveTimer?: number;
    saving?: Promise<void>;
    battlePoints: HTMLElement;
    library: RawAdversary[] = [];
    updateState: Debouncer<[], Promise<void>>;

    updateStatusBar() {
        const file = this.app.workspace.getActiveFile();
        if (file) {
            const bp = Math.ceil(this.calculateBattlePoints(file?.path));
            const pcs = this.state.settings.numberOfPCs;
            if (bp > 0) {
                this.battlePoints.setText(`${bp} battle points`);
                setTooltip(this.battlePoints, `${bp} / ${pcs * 3 + 2} for ${pcs} PCs`, { delay: 500, placement: 'top' });;
                return;
            }
        }
        this.battlePoints.setText('');
    }

    calculateBattlePoints(filePath: string): number {
        let totalBP = 0;
        const bpPerType: Record<string, number> = {
            'solo': 5,
            'bruiser': 4,
            'leader': 3,
            'horde': 2,
            'skulk': 2,
            'ranged': 2,
            'standard': 2,
            'support': 1,
            'social': 1,
            'minion': 1 / this.state.settings.numberOfPCs,
        }
        for (const [block, path] of this.activeBlocks) {
            if (path !== filePath) continue;
            if (!block.adv.hp && !block.adv.stress) continue; // is an env
            const type = block.adv.type?.trim().toLowerCase();
            if (type?.startsWith('horde')) totalBP += bpPerType['horde'] * block.count;
            if (type && bpPerType[type]) totalBP += bpPerType[type] * block.count;
        }
        return totalBP;
    }

    async scanLibrary(notFoundNotice: boolean, loadedNotice: 'yes' | 'no' | 'conditional') {
        const folderPaths = this.state.settings.libraryFolders.filter(p => p.trim() !== '');
        if (folderPaths.length === 0) {
            this.library = [];
            return;
        }
        const newLibrary: RawAdversary[] = [];
        const missingFolders: string[] = [];
        for (const folderPath of folderPaths) {
            const folder = this.app.vault.getFolderByPath(folderPath);
            if (!folder) {
                missingFolders.push(folderPath);
                continue;
            }
            await walkFolder(folder, async (file) => {
            let content: RawAdversary | RawAdversary[];

            if (file.extension == 'json') {
                try {
                    content = JSON.parse(await this.app.vault.read(file));
                } catch (e) {
                    console.error(`Failed to parse ${file.path}:\n`, e);
                    return;
                }
            } else if (file.extension == 'yml' || file.extension == 'yaml') {
                content = tryParseYaml(await this.app.vault.read(file));
            } else if (file.extension == 'md') {
                const metadata = this.app.metadataCache.getFileCache(file)
                content = [];

                // Check frontmatter for adversary data
                const fm = metadata?.frontmatter;
                if (fm && typeof fm.name === 'string') {
                    const entry: RawAdversary = {
                        name: fm.name,
                        tier: fm.tier,
                        type: fm.role ?? fm.type,
                        desc: fm.desc ?? fm.description,
                        difficulty: fm.difficulty,
                        hp: fm.hp,
                        stress: fm.stress,
                        thresholds: fm.thresholds,
                        motives: fm.motives ?? fm.motives_and_tactics,
                        xp: fm.xp ?? fm.experience,
                        attack: fm.atk_bonus ?? fm.atk ?? fm.attack,
                        weapon: fm.weapon_name ?? fm.weapon,
                        range: fm.weapon_range ?? fm.range,
                        damage: fm.damage,
                        tone: fm.tone,
                        impulses: fm.impulses,
                        adversaries: fm.adversaries ?? fm.potential_adversaries,
                        source: fm.source,
                    };

                    // Enrich from markdown body if fields are missing
                    const bodyText = await this.app.vault.read(file);

                    if (!entry.desc) {
                        const descMatch = bodyText.match(/^\*([^*].+?)\*\s*$/m);
                        if (descMatch) entry.desc = descMatch[1];
                    }
                    if (!entry.motives) {
                        const motivesMatch = bodyText.match(/\*\*Motives\s*(?:&|and)\s*Tactics:\*\*\s*(.*)/i);
                        if (motivesMatch) entry.motives = motivesMatch[1].trim();
                    }
                    if (!entry.xp) {
                        const xpMatch = bodyText.match(/\*\*Experience:\*\*\s*(.*)/i);
                        if (xpMatch) entry.xp = xpMatch[1].trim();
                    }
                    if (!entry.features || entry.features.length === 0) {
                        const features: { name: string; type: string; desc: string }[] = [];
                        const featureRegex = /\*{3}(.+?)\s*[-–—]\s*(\w+):\*{3}\s*([\s\S]*?)(?=\n\n\*{3}|\n\n#{1,3}\s|$)/g;
                        let featureMatch;
                        while ((featureMatch = featureRegex.exec(bodyText)) !== null) {
                            features.push({
                                name: featureMatch[1].trim(),
                                type: featureMatch[2].trim(),
                                desc: featureMatch[3].trim(),
                            });
                        }
                        if (features.length > 0) entry.features = features;
                    }

                    content.push(entry);
                }

                // Also check for daggerheart code blocks
                const codeblocks = metadata?.sections?.filter(sec => sec.type == 'code') ?? [];
                if (codeblocks.length > 0) {
                const lines = (await this.app.vault.read(file)).split('\n');
                content = content.concat(codeblocks
                    .filter(sec => lines[sec.position.start.line].trim() === '```daggerheart')
                    .map(sec => {
                        const targetLines = lines.slice(sec.position.start.line + 1, sec.position.end.line).join("\n");
                        return { raw: targetLines, ...tryParseYaml(targetLines) };
                    }));
                // Also scan FSB-compatible statblocks
                if (this.state.settings.compatibleWithFSB) {
                    const fsb: RawAdversary[] = codeblocks
                        .filter(sec => lines[sec.position.start.line].trim() === '```statblock')
                        .map(sec => {
                            const targetLines = lines.slice(sec.position.start.line + 1, sec.position.end.line).join("\n");
                            const statblock = tryParseYaml(targetLines);
                            const isDaggerheart = statblock.layout && typeof statblock.layout == 'string' && /daggerheart\s+(environment|adversary)/i.test(statblock.layout);
                            if (!isDaggerheart) return null;
                            return {
                                name: statblock.name,
                                tier: statblock.tier,
                                type: statblock.type,
                                desc: statblock.description,
                                difficulty: statblock.difficulty,

                                hp: statblock.hp,
                                stress: statblock.stress,
                                thresholds: statblock.thresholds,
                                motives: statblock.motives_and_tactics,
                                xp: statblock.experience,
                                attack: statblock.atk,

                                weapon: statblock.attack,
                                range: statblock.range,
                                damage: statblock.damage,

                                impulses: statblock.impulses,
                                adversaries: statblock.potential_adversaries,

                                features: statblock.feats?.map((f?: { name?: string, text?: string }) => ({
                                    name: f?.name,
                                    desc: f?.text
                                })),

                                source: statblock.source,
                            } as RawAdversary;
                        })
                        .filter((s: RawAdversary | null) => s != null);
                    content = content.concat(fsb);
                }
                }
            } else {
                return;
            }

            if (!Array.isArray(content)) content = [content];
            for (const item of content) {
                if (item && typeof item == 'object' && typeof item.name == 'string') {
                    newLibrary.push({ source: 'homebrew', ...item });
                }
            }
        })
        }

        if (notFoundNotice && missingFolders.length > 0) {
            new Notice(`Library folders not found: ${missingFolders.join(', ')}`);
        }

        if (this.state.settings.ignoreDuplicateNames) {
            this.library = [];
            for (const adv of newLibrary) {
                if (ADV_LIBRARY.find(a => a.name == adv.name)
                    || ENV_LIBRARY.find(a => a.name == adv.name)
                    || this.library.find(a => a.name == adv.name)) {
                    adv.id = 'duplicate';
                    continue;
                }
                this.library.push(adv);
            }
        } else {
            this.library = newLibrary;
        }

        const length = this.library.length;
        if (loadedNotice === 'yes' || loadedNotice === 'conditional' && length > 0) {
            if (length == 0) {
                new Notice(`No valid stat blocks found in library folders`);
            } else {
                // TODO: message about duplicates?
                new Notice(`Loaded ${length} stat block${length != 1 ? 's' : ''}`)
            }
        }

        return newLibrary;
    }

    allAdversaries(): RawAdversary[] {
        const homebrew = this.library.filter(adv => (adv.hp && adv.hp > 0) || (adv.stress && adv.stress > 0));
        if (this.state.settings.hideBuiltInLibrary) return homebrew;
        return homebrew.concat(ADV_LIBRARY);
    }

    allEnvironments(): RawAdversary[] {
        const homebrew = this.library.filter(adv => (!adv.hp || adv.hp == 0) && (!adv.stress || adv.stress == 0));
        if (this.state.settings.hideBuiltInLibrary) return homebrew;
        return homebrew.concat(ENV_LIBRARY);
    }

    async onload() {
        this.state = Object.assign({}, { settings: {}, cards: {} }, await this.loadData());
        this.state.settings = Object.assign({}, DEFAULT_SETTINGS, this.state.settings);
        // Migration: libraryFolder (string) -> libraryFolders (array)
        if (this.state.settings.libraryFolder && this.state.settings.libraryFolders.length === 0) {
            this.state.settings.libraryFolders = [this.state.settings.libraryFolder];
            delete this.state.settings.libraryFolder;
            this.saveData(this.state);
        }
        this.battlePoints = this.addStatusBarItem();
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateStatusBar()));
        this.app.workspace.onLayoutReady(() => this.scanLibrary(false, 'no'));
        this.updateState = debounce(() => this.saveData(this.state), 1000, true);

        this.registerMarkdownCodeBlockProcessor("daggerheart", (src, el, ctx) => {
            const child = new AdversaryCard(el, tryParseYaml(src, false), this, ctx);
            ctx.addChild(child);
            child.render();
            // Track it so we can refresh on settings change:
            this.activeBlocks.set(child, this.app.workspace.getActiveFile()?.path ?? ctx.sourcePath);
            this.updateStatusBar();
            // Ensure we stop tracking when the block is removed:
            child.register(() => {
                this.activeBlocks.delete(child);
                this.updateStatusBar();
            });
        });

        this.addSettingTab(new SettingTab(this.app, this));

        this.addCommand({
            id: 'insert-adversary-template',
            name: 'Insert adversary template',
            editorCallback: (editor: Editor) => {
                editor.replaceRange(ADV_TEMPLATE.trim(), editor.getCursor());
            },
        })
        this.addCommand({
            id: 'insert-environment-template',
            name: 'Insert environment template',
            editorCallback: (editor: Editor) => {
                editor.replaceRange(ENV_TEMPLATE.trim(), editor.getCursor());
            },
        })
        this.addCommand({
            id: 'clear-card-state',
            name: 'Clear all card state',
            callback: () => {
                this.state.cards = {};
                this.updateState();
                this.renderAll();
            }
        })
        this.addCommand({
            id: 'insert-adversary-from-library',
            name: 'Insert adversary from library',
            editorCallback: (editor: Editor) => {
                new AdversaryModal(this.app, editor, this.allAdversaries()).open();
            },
        });
        this.addCommand({
            id: 'insert-environment-from-library',
            name: 'Insert environment from library',
            editorCallback: (editor: Editor) => {
                new AdversaryModal(this.app, editor, this.allEnvironments()).open();
            },
        });
        this.addCommand({
            id: 'refresh-library',
            name: 'Refresh library',
            callback: () => this.scanLibrary(true, 'yes')
        })

        this.addRibbonIcon('swords', "Arrowed's Adversary Bank", (event) => {
            const menu = new Menu();
            const onClick = (callback: (editor: Editor) => void) => () => {
                const editor = this.app.workspace.activeEditor?.editor;
                if (!editor) {
                    new Notice('No active editor');
                } else {
                    callback(editor);
                }
            }

            menu.addItem((item) => item
                .setTitle('Insert adversary from library')
                .setIcon('book-copy')
                .onClick(onClick((editor) => new AdversaryModal(this.app, editor, this.allAdversaries()).open())));

            menu.addItem((item) => item
                .setTitle('Insert adversary template')
                .setIcon('book-dashed')
                .onClick(onClick((editor) => editor.replaceRange(ADV_TEMPLATE.trim(), editor.getCursor()))));

            menu.addSeparator();

            menu.addItem((item) => item
                .setTitle('Insert environment from library')
                .setIcon('book-copy')
                .onClick(onClick((editor) => new AdversaryModal(this.app, editor, this.allEnvironments()).open())));

            menu.addItem((item) => item
                .setTitle('Insert environment template')
                .setIcon('book-dashed')
                .onClick(onClick((editor) => editor.replaceRange(ENV_TEMPLATE.trim(), editor.getCursor()))));

            menu.addSeparator();

            menu.addItem((item) => item
                .setTitle('Refresh library')
                .setIcon('refresh-cw')
                .onClick(() => this.scanLibrary(true, 'yes')));

            menu.showAtMouseEvent(event);
        });
    }

    onunload() {
        void this.updateState.run();
    }

    renderAll() {
        for (const [block] of this.activeBlocks) {
            block.render();
        }
    }

    updateCard(keys: (string | number)[], value: string | number) {
        type Data = { [key: string]: Data | number | string | string[] };
        let data: Data = this.state.cards;
        const keysCopy = [...keys];
        const lastKey = keysCopy.pop()!;
        for (const key of keysCopy) {
            if (!data[key]) data[key] = {};
            data = data[key] as Data;
        }
        data[lastKey] = value;
        this.updateState();
    }

    getCardState(keys: (string | number)[]): number | undefined {
        type Data = { [key: string]: Data | string | number | string[] }
        let data: Data = this.state.cards;
        for (const [i, key] of keys.entries()) {
            if (!data[key]) return undefined;
            if (i === keys.length - 1) return data[key] as number;
            data = data[key] as Data;
        }
    }
}

