import { App, Editor, SuggestModal, Modal, Setting, Notice, MarkdownRenderChild, stringifyYaml, setIcon, MarkdownRenderer, Menu, Platform, type MarkdownPostProcessorContext } from 'obsidian';
import { roll } from '@airjp73/dice-notation';
import BeastVault, { type InstanceOverrides, type PluginState } from './main';
import { hexToRgb, DICE_PATTERN, processAdversary, DH_CONDITIONS, autoSuffixName } from './utils';

interface DiceRollerElement {
    resultEl?: HTMLElement;
    hasRunOnce: boolean;
    containerEl: HTMLElement;
}

interface DiceRollerApi {
    getRoller(dice: string, sourcePath: string): DiceRollerElement | null | undefined;
}

declare global {
    interface Window {
        DiceRoller?: DiceRollerApi;
    }
}

/** Returns the dice-roller plugin's API (window.DiceRoller) if available, or null. */
function getDiceRollerAPI(): DiceRollerApi | null {
    return window.DiceRoller ?? null;
}

function appendDiceRoller(parent: HTMLElement, roller: DiceRollerElement, dice: string) {
    if (roller.resultEl) roller.resultEl.textContent = dice;
    roller.hasRunOnce = true;
    parent.appendChild(roller.containerEl);
}

/** Create an inline dice element — uses dice-roller plugin if available, otherwise a plain rollable span. */
async function diceElement(dice: string, sourcePath: string, parent: HTMLElement): Promise<void> {
    const api = getDiceRollerAPI();
    if (api) {
        try {
            const roller = api.getRoller(dice, sourcePath);
            if (roller) {
                // Don't auto-roll — show formula text until user clicks the dice icon
                appendDiceRoller(parent, roller, dice);
                return;
            }
        } catch { /* fall through to fallback */ }
    }
    parent.createSpan({ text: dice, cls: 'bv-rollable' });
}

/**
 * Characters that could begin a markdown construct we care about inline
 * (emphasis, code, strikethrough, highlight, links, wikilinks, raw HTML, tags,
 * HTML entities, backslash escapes). Used only to skip the renderer for plain
 * text — a false positive costs a wasted render, never a wrong result.
 */
const INLINE_MARKDOWN_CHARS = /[*_`~=[\]<#&\\]/;

/**
 * Render a stat block field as inline markdown.
 *
 * Obsidian's renderer always emits block-level output, so a lone wrapping `<p>`
 * is unwrapped to keep the text flowing with whatever sits beside it (labels,
 * separators, dice). Text with no markdown-ish characters bypasses the renderer
 * entirely: a card can hold dozens of fields and the full markdown pipeline is
 * far more expensive than setting text directly.
 *
 * Surrounding whitespace is restored around the rendered output. Markdown strips
 * it, which would run a fragment straight into its neighbour — `damage: "2d6 ==mag=="`
 * splits into a dice roller plus the literal text `" ==mag=="`, and that leading
 * space is the gap between them.
 */
async function renderInlineMarkdown(
    plugin: BeastVault,
    text: string,
    parent: HTMLElement,
    sourcePath: string,
    component: MarkdownRenderChild,
): Promise<void> {
    if (!INLINE_MARKDOWN_CHARS.test(text)) {
        parent.appendText(text);
        return;
    }

    const [, leading, core, trailing] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? ['', '', text, ''];
    if (leading) parent.appendText(leading);

    const scratch = createDiv();
    await MarkdownRenderer.render(plugin.app, core, scratch, sourcePath, component);
    const onlyChild = scratch.children.length === 1 ? scratch.firstElementChild : null;
    const source = onlyChild?.tagName === 'P' ? onlyChild : scratch;
    while (source.firstChild) {
        parent.appendChild(source.firstChild);
    }

    if (trailing) parent.appendText(trailing);
}

type CardEntry = NonNullable<PluginState['cards'][string]>;
type InstanceEntry = CardEntry[number];

type Feature = {
    name?: string;
    type?: string;
    desc?: string;
    uses?: number;
    countdown?: number;
    flavor?: string;
    summon?: string | string[];
}

// Stored in library, as entered by user.
// Pasted into editor when inserted.
export type RawAdversary = {
    name?: string;
    tier?: number;
    type?: string;
    desc?: string;
    difficulty?: string | number;
    features?: Feature[];

    // these are for environments
    tone?: string;
    impulses?: string;
    adversaries?: string;

    // these are for adversaries
    hp?: number;
    stress?: number;
    thresholds?: string | number | number[];
    attack?: string | number;
    xp?: string | string[];
    motives?: string;

    weapon?: string;
    range?: string;
    damage?: string;

    // custom conditions defined on this statblock
    conditions?: string | string[];

    // these are not rendered
    source?: string;
    id?: string;
    raw?: string;
};

// Used when rendering.
// 'id' is not rendered but required to track state.
export type Adversary = Omit<RawAdversary, 'source' | 'raw'> & {
    difficulty?: string;
    features: Feature[];
    hp: number; // 0 for environments
    stress: number; // 0 for environments
    thresholds: number[];
    attack?: string;
    xp: string[];
    id: string;
}

function subTitle(tier?: number, type?: string) {
    return (tier ? `Tier ${tier} ` : '') + (type ? type : '');
}

/**
 * Build a `name:` YAML line, quoted as the value requires.
 *
 * Names support markdown, so a perfectly ordinary rename to `**Wolf**` would be
 * invalid YAML written literally (`*` opens an alias). Round-tripping through
 * the serializer adds quotes only where they're needed. Folded or multi-line
 * output is rejected — it can't be spliced into a single line — leaving the
 * caller to skip the edit rather than corrupt the block.
 */
function nameLine(name: string): string | null {
    const yaml = stringifyYaml({ name }).trimEnd();
    return yaml.includes('\n') ? null : yaml;
}

export class AdversaryModal extends SuggestModal<RawAdversary> {
    constructor(app: App, private editor: Editor, private library: RawAdversary[]) {
        super(app);
        this.limit = 200;
    }

    getSuggestions(query: string): RawAdversary[] {
        return this.library.filter((adv: Adversary) =>
            adv.name!.toLowerCase().includes(query.toLowerCase())
        );
    }

    renderSuggestion(adv: RawAdversary, el: HTMLElement) {
        const heading = el.createDiv({ cls: 'bv-spreadout' });
        heading.createEl('b', { text: adv.name?.toUpperCase() || '' });
        heading.createSpan({ text: subTitle(adv.tier, adv.type), cls: 'bv-smaller' });
        el.createSpan({ text: adv.desc ?? '', cls: 'bv-smaller bv-muted' });
    }

    onChooseSuggestion(adv: RawAdversary, evt: MouseEvent | KeyboardEvent) {
        const copy = { ...adv };
        copy.id = Math.random().toString(36).slice(2);
        delete copy.source;
        delete copy.raw;

        // Auto-suffix for adversaries (has hp or stress), not environments
        if (adv.hp || adv.stress) {
            const content = this.editor.getValue();
            const baseName = adv.name ?? '';
            const suffixed = autoSuffixName(baseName, content);
            if (suffixed !== baseName) {
                copy.name = suffixed;
            }
        }

        let inserted: string;
        if (adv.raw) {
            // For raw (homebrew) entries, string-replace the name: line
            inserted = adv.raw;
            const renamed = copy.name !== adv.name ? nameLine(copy.name ?? '') : null;
            if (renamed) {
                inserted = inserted.replace(/^name:\s*.*$/m, renamed);
            }
        } else {
            inserted = stringifyYaml(copy);
        }
        this.editor.replaceSelection(`\`\`\`daggerheart\n${inserted.trim()}\n\`\`\`\n`);
    }
}

export class FolderPickerModal extends Modal {
    private selected: Set<string>;
    private listEl: HTMLElement;
    private searchEl: HTMLInputElement;

    constructor(app: App, currentFolders: string[], private onSubmit: (folders: string[]) => void) {
        super(app);
        this.selected = new Set(currentFolders);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bv-folder-picker');

        contentEl.createEl('h3', { text: 'Select library folders' });

        const searchContainer = contentEl.createDiv({ cls: 'bv-folder-search' });
        this.searchEl = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search folders...',
            cls: 'bv-folder-search-input',
        });
        this.searchEl.addEventListener('input', () => this.renderList());

        this.listEl = contentEl.createDiv({ cls: 'bv-folder-list' });
        this.renderList();

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Done')
                .setCta()
                .onClick(() => {
                    this.onSubmit([...this.selected]);
                    this.close();
                }));
    }

    private renderList() {
        this.listEl.empty();
        const query = this.searchEl.value.toLowerCase();
        const allFolders = this.app.vault.getAllFolders(false)
            .sort((a, b) => a.path.localeCompare(b.path));

        // Show selected folders first, then unselected
        const sorted = [...allFolders].sort((a, b) => {
            const aSelected = this.selected.has(a.path) ? 0 : 1;
            const bSelected = this.selected.has(b.path) ? 0 : 1;
            if (aSelected !== bSelected) return aSelected - bSelected;
            return a.path.localeCompare(b.path);
        });

        let shown = 0;
        for (const folder of sorted) {
            if (query && !folder.path.toLowerCase().includes(query)) continue;
            if (shown >= 100) break;
            shown++;

            const row = this.listEl.createDiv({ cls: 'bv-folder-row' });
            if (this.selected.has(folder.path)) row.addClass('is-selected');

            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = this.selected.has(folder.path);

            row.createSpan({ text: folder.path, cls: 'bv-folder-path' });

            const toggle = () => {
                if (this.selected.has(folder.path)) {
                    this.selected.delete(folder.path);
                    row.removeClass('is-selected');
                    checkbox.checked = false;
                } else {
                    this.selected.add(folder.path);
                    row.addClass('is-selected');
                    checkbox.checked = true;
                }
            };
            row.addEventListener('click', (e) => {
                if (e.target !== checkbox) toggle();
            });
            checkbox.addEventListener('change', toggle);
        }

        if (shown === 0) {
            this.listEl.createDiv({ text: 'No folders found', cls: 'bv-folder-empty' });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class AdversaryCard extends MarkdownRenderChild {
    count: number;
    filePath: string;
    /**
     * Path that links and dice resolve against.
     *
     * Deliberately separate from `filePath`: that one seeds the auto-generated
     * stat block id, so repointing it would change ids and orphan tracked state
     * on existing cards. The rendering context knows the file the code block
     * actually lives in, which is what relative links need — `getActiveFile()`
     * is the wrong note whenever a card renders in an embed, a canvas, or in
     * the background.
     */
    private renderPath: string;
    public adv: Adversary;

    constructor(
        private container: HTMLElement,
        public raw: RawAdversary,
        private plugin: BeastVault,
        private ctx?: MarkdownPostProcessorContext
    ) {
        super(container);
        this.filePath = this.plugin.app.workspace.getActiveFile()?.path ?? '/';
        this.renderPath = this.ctx?.sourcePath || this.filePath;
        this.adv = processAdversary(raw, this.filePath);
        this.count = this.plugin.state.cards[this.adv.id]?.count || 1;
    }

    private ensureCardState(): CardEntry {
        this.plugin.state.cards[this.adv.id] ??= {};
        return this.plugin.state.cards[this.adv.id];
    }

    private ensureInstanceState(index: number): InstanceEntry {
        const card = this.ensureCardState();
        card[index] ??= {};
        return card[index];
    }

    getOverrides(): InstanceOverrides | undefined {
        return this.plugin.state.cards[this.adv.id]?.overrides;
    }

    isOverridden<K extends keyof InstanceOverrides>(field: K): boolean {
        return this.getOverrides()?.[field] !== undefined;
    }

    getField<K extends keyof InstanceOverrides & keyof Adversary>(field: K): Adversary[K] {
        const overrides = this.getOverrides();
        if (overrides && overrides[field] !== undefined) {
            return overrides[field] as Adversary[K];
        }
        return this.adv[field];
    }

    /**
     * Clamp every instance's HP and stress marks against the current effective max.
     * Run after any change that can lower the effective max — setting a lower override,
     * clearing a higher override (so the library value re-takes effect), or resetting
     * all overrides.
     */
    private clampAllMarks() {
        const card = this.plugin.state.cards[this.adv.id];
        if (!card) return;
        const effHp = this.getField('hp');
        const effStress = this.getField('stress');
        for (const key of Object.keys(card)) {
            const n = Number(key);
            if (!Number.isInteger(n) || n < 0) continue;
            const inst = card[n];
            if (!inst) continue;
            if ((inst.hp ?? 0) > effHp) inst.hp = effHp;
            if ((inst.stress ?? 0) > effStress) inst.stress = effStress;
        }
    }

    setOverrides(partial: InstanceOverrides) {
        const card = this.ensureCardState();
        const next: InstanceOverrides = { ...(card.overrides ?? {}) };
        for (const k of Object.keys(partial) as (keyof InstanceOverrides)[]) {
            const v = partial[k];
            if (v === undefined) {
                delete next[k];
            } else {
                (next as Record<string, unknown>)[k] = v;
            }
        }
        if (Object.keys(next).length === 0) {
            delete card.overrides;
        } else {
            card.overrides = next;
        }
        this.clampAllMarks();
        this.plugin.updateState();
    }

    /**
     * Reset combat state for a single instance: HP marks, stress marks, conditions,
     * feature uses, and countdowns. Preserves instance name, count, color, and any
     * card-level overrides (overrides reset only via the edit modal).
     */
    resetInstance(index: number) {
        const inst = this.plugin.state.cards[this.adv.id]?.[index];
        if (!inst) return;
        delete inst.hp;
        delete inst.stress;
        delete inst.conditions;
        delete inst.uses;
        delete inst.countdown;
        this.plugin.updateState();
    }

    /** Clear all card-level overrides; combat state on every instance is left alone. */
    resetOverrides() {
        const card = this.plugin.state.cards[this.adv.id];
        if (!card?.overrides) return;
        delete card.overrides;
        // Library max may now be lower than what an instance had marked under the
        // previous override; clamp before persisting.
        this.clampAllMarks();
        this.plugin.updateState();
    }

    /** Render `text` as inline markdown into `parent`, sourced from this card's file. */
    private inline(parent: HTMLElement, text: string): Promise<void> {
        return renderInlineMarkdown(this.plugin, text, parent, this.renderPath, this);
    }

    /**
     * Render `text` as inline markdown with dice notation turned into rollers.
     *
     * Dice become placeholder spans *before* rendering and are swapped for live
     * rollers afterwards. Splitting the string on dice and rendering each piece
     * separately would break any markdown spanning a dice expression —
     * `damage: "Take *2d6 magic* damage"` would render two fragments with
     * unmatched asterisks instead of one emphasised phrase.
     */
    private async inlineWithDice(parent: HTMLElement, text: string): Promise<void> {
        const placeholderClass = getDiceRollerAPI() ? 'bv-dice-placeholder' : 'bv-rollable';
        await this.inline(parent, text.replace(
            DICE_PATTERN,
            `<span class="${placeholderClass}" data-dice="$&">$&</span>`,
        ));
        this.swapDicePlaceholders(parent);
    }

    /** Replace rendered dice placeholders with live dice-roller elements. */
    private swapDicePlaceholders(root: HTMLElement) {
        const api = getDiceRollerAPI();
        if (!api) return;
        for (const el of Array.from(root.querySelectorAll('.bv-dice-placeholder'))) {
            const dice = el.getAttribute('data-dice');
            if (!dice) continue;
            const wrapper = createSpan();
            try {
                const roller = api.getRoller(dice, this.renderPath);
                if (roller) {
                    appendDiceRoller(wrapper, roller, dice);
                } else {
                    wrapper.createSpan({ text: dice, cls: 'bv-rollable' });
                }
            } catch {
                wrapper.createSpan({ text: dice, cls: 'bv-rollable' });
            }
            el.replaceWith(wrapper);
        }
    }

    async createTitle(card: HTMLElement) {
        const title = card.createDiv({ cls: 'callout-title bv-spreadout' });
        const nameEl = title.createEl('b', { cls: 'bv-larger bv-renameable' });
        await this.inline(nameEl, this.adv.name || '');
        title.createEl('b', { cls: 'bv-smaller bv-padded', text: subTitle(this.adv.tier, this.adv.type) });

        const openRenameInput = () => {
            const input = createEl('input', { type: 'text', value: this.adv.name || '', cls: 'bv-rename-input' });
            nameEl.replaceWith(input);
            input.focus();
            input.select();

            const commit = () => {
                const newName = input.value.trim();
                if (newName && newName !== this.adv.name) {
                    this.renameTo(newName);
                } else {
                    void this.render();
                }
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') void this.render();
            });
            input.addEventListener('blur', commit);
        };

        if (Platform.isMobile) {
            let pressTimer: number | null = null;
            nameEl.addEventListener('touchstart', (e) => {
                pressTimer = window.setTimeout(() => {
                    pressTimer = null;
                    e.preventDefault();
                    openRenameInput();
                }, 500);
            }, { passive: false });
            nameEl.addEventListener('touchend', () => {
                if (pressTimer !== null) { window.clearTimeout(pressTimer); pressTimer = null; }
            });
            nameEl.addEventListener('touchmove', () => {
                if (pressTimer !== null) { window.clearTimeout(pressTimer); pressTimer = null; }
            });
        } else {
            nameEl.addEventListener('dblclick', openRenameInput);
        }
    }

    private renameTo(newName: string) {
        const sectionInfo = this.ctx?.getSectionInfo(this.container);
        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!sectionInfo || !editor) return;

        const replacement = nameLine(newName);
        if (replacement === null) {
            new Notice('That name can\'t be written to YAML on one line');
            return;
        }

        const { lineStart, lineEnd } = sectionInfo;
        for (let i = lineStart; i <= lineEnd; i++) {
            const line = editor.getLine(i);
            if (/^name:\s/.test(line)) {
                editor.replaceRange(
                    `${replacement}\n`,
                    { line: i, ch: 0 },
                    { line: i + 1, ch: 0 }
                );
                break;
            }
        }
    }

    private markStressOnInstance(index: number) {
        const keys: (string | number)[] = [this.adv.id, index, 'stress'];
        const current = this.plugin.getCardState(keys) ?? 0;
        const effStress = this.getField('stress');
        if (current >= effStress) {
            new Notice('All stress slots already marked');
            return;
        }
        this.plugin.updateCard(keys, current + 1);
        void this.render();

        const cardState = this.plugin.state.cards[this.adv.id];
        const savedName = cardState?.[index]?.instanceName;
        const label = this.count > 1
            ? (savedName || `${this.adv.name || 'Instance'} ${index + 1}`)
            : (this.adv.name || 'Adversary');
        new Notice(`${label}: marked stress (${current + 1}/${effStress})`);
    }

    async createHeaderEntry(header: HTMLElement, name: string, entry: string | string[] | undefined, overridden = false) {
        const value = Array.isArray(entry) ? entry.join(', ') : entry;
        if (!value) return;
        const wrap = header.createSpan({ cls: overridden ? 'bv-overridden' : undefined });
        wrap.createEl('b', { text: `${name}: ` });
        await this.inline(wrap.createSpan(), value);
        header.createEl('br');
    }

    async createHeader(content: HTMLElement) {
        if (this.adv.desc) {
            const desc = content.createEl('p', { cls: "bv-smaller bv-muted bv-padded" });
            await this.inline(desc.createEl('i'), this.adv.desc);
        }

        const header = content.createEl('p', { cls: 'bv-smaller' });
        const effDifficulty = this.getField('difficulty');
        await this.createHeaderEntry(header, 'Difficulty', effDifficulty, this.isOverridden('difficulty'));

        const effAttack = this.getField('attack');
        if (effAttack != null) {
            const attackWrap = header.createSpan({ cls: this.isOverridden('attack') ? 'bv-overridden' : undefined });
            attackWrap.createEl('b', { text: 'Attack: ' });
            const attackDice = `1d20${effAttack === '0' ? '' : effAttack}`;
            await diceElement(attackDice, this.renderPath, attackWrap);
            header.createEl('br');
        }

        const effWeapon = this.getField('weapon');
        const effRange = this.getField('range');
        const effDamage = this.getField('damage');
        if (effWeapon || effRange || effDamage) {
            const weaponWrap = header.createSpan({
                cls: (this.isOverridden('weapon') || this.isOverridden('range') || this.isOverridden('damage')) ? 'bv-overridden' : undefined,
            });
            const label = weaponWrap.createEl('b');
            await this.inline(label, effWeapon || 'Weapon');
            label.appendText(': ');
            if (effRange) await this.inline(weaponWrap.createSpan(), effRange);
            weaponWrap.createSpan({ text: (effRange && effDamage) ? ' | ' : '' });
            if (effDamage) {
                await this.inlineWithDice(weaponWrap.createSpan(), effDamage);
            }
            header.createEl('br');
        }
        await this.createHeaderEntry(header, 'Experience', this.adv.xp);
        await this.createHeaderEntry(header, 'Motives & Tactics', this.getField('motives'), this.isOverridden('motives'));
        await this.createHeaderEntry(header, 'Tone & Feel', this.adv.tone);
        await this.createHeaderEntry(header, 'Impulses', this.adv.impulses);
        await this.createHeaderEntry(header, 'Potential Adversaries', this.adv.adversaries);
    }

    async createFeature(content: HTMLElement, index: number, feature: Feature) {
        const paragraph = content.createEl('p', { cls: 'bv-smaller' })
        await this.inline(paragraph.createEl('b'), feature.name || '');
        paragraph.createSpan({ text: feature.type && `${feature.name}` ? ' - ' : '' });
        await this.inline(paragraph.createSpan(), feature.type || '');
        if (feature.type || feature.name) {
            paragraph.createEl('br');
        }
        if (this.count == 1) {
            this.createStatSlots(paragraph, 'Uses', feature.uses || 0, [this.adv.id, 0, 'uses', index]);
            // For now, we only have countdowns in environments
            this.createStatSlots(paragraph, 'Countdown', feature.countdown || 0, [this.adv.id, 0, 'countdown', index]);
        }
        if (feature.desc) {
            // Rendered as a block (not via inline()) so descriptions keep their
            // paragraphs and lists.
            const featureDiv = paragraph.createDiv({ cls: 'bv-feature' });
            const placeholderClass = getDiceRollerAPI() ? 'bv-dice-placeholder' : 'bv-rollable';
            await MarkdownRenderer.render(
                this.plugin.app,
                feature
                    .desc
                    .replace(/\b([sS])pend a [fF]ear\b/g, "<b>$1pend a Fear</b>")
                    .replace(/\b([mM])ark a [sS]tress\b/g, '<b class="bv-mark-stress">$1ark a Stress</b>')
                    .replace(DICE_PATTERN, `<span class="${placeholderClass}" data-dice="$&">$&</span>`),
                featureDiv,
                this.renderPath,
                this
            );
            this.swapDicePlaceholders(featureDiv);
        }
        // Summon buttons
        if (feature.summon) {
            const summons = Array.isArray(feature.summon) ? feature.summon : [feature.summon];
            const summonDiv = paragraph.createDiv({ cls: 'bv-summon-bar' });
            for (const summonName of summons) {
                const btn = summonDiv.createEl('button', {
                    text: `Summon: ${summonName}`,
                    cls: 'bv-summon-button',
                });
                btn.addEventListener('click', () => this.summonAdversary(summonName));
            }
        }

        if (feature.flavor) {
            await this.inline(paragraph.createDiv().createEl('i', { cls: 'bv-muted' }), feature.flavor);
        }
    }

    private summonAdversary(name: string) {
        const allAdv = this.plugin.allAdversaries();
        const allEnv = this.plugin.allEnvironments();
        const match = [...allAdv, ...allEnv].find(
            a => a.name?.toLowerCase() === name.toLowerCase()
        );

        if (!match) {
            new Notice(`"${name}" not found in library`);
            return;
        }

        const editor = this.plugin.app.workspace.activeEditor?.editor;
        if (!editor) {
            new Notice('No active editor');
            return;
        }

        const copy = { ...match };
        copy.id = Math.random().toString(36).slice(2);
        delete copy.source;
        delete copy.raw;

        // Apply auto-suffix if this is an adversary
        if (match.hp || match.stress) {
            const content = editor.getValue();
            const baseName = match.name ?? '';
            const suffixed = autoSuffixName(baseName, content);
            if (suffixed !== baseName) {
                copy.name = suffixed;
            }
        }

        let yaml: string;
        if (match.raw) {
            yaml = match.raw;
            const renamed = copy.name !== match.name ? nameLine(copy.name ?? '') : null;
            if (renamed) {
                yaml = yaml.replace(/^name:\s*.*$/m, renamed);
            }
        } else {
            yaml = stringifyYaml(copy);
        }

        const lastLine = editor.lastLine();
        const lastLineContent = editor.getLine(lastLine);
        const insertPos = { line: lastLine, ch: lastLineContent.length };
        editor.replaceRange(`\n\n\`\`\`daggerheart\n${yaml.trim()}\n\`\`\`\n`, insertPos);
        new Notice(`Summoned ${copy.name}`);
    }

    createConditionBar(parent: HTMLElement, index: number) {
        const condBar = parent.createDiv({ cls: 'bv-conditions' });
        const cardState = this.plugin.state.cards[this.adv.id];
        const instance = cardState?.[index] as InstanceEntry | undefined;
        const current: string[] = Array.isArray(instance?.conditions) ? instance.conditions : [];

        // Build full condition list: standard + YAML-defined custom + any ad-hoc from state
        const yamlCustom = this.raw.conditions
            ? (Array.isArray(this.raw.conditions) ? this.raw.conditions : [this.raw.conditions])
            : [];
        const standardNames = DH_CONDITIONS as readonly string[];
        const allDefined = [...DH_CONDITIONS, ...yamlCustom.filter(c => !standardNames.includes(c))];
        // Also include any ad-hoc conditions that are in state but not in the defined list
        const adHoc = current.filter(c => !allDefined.includes(c));
        const allConditions = [...allDefined, ...adHoc];

        const addBadge = (condition: string) => {
            const active = current.includes(condition);
            const isCustom = !standardNames.includes(condition);
            const badge = condBar.createSpan({
                text: condition,
                cls: `bv-condition-badge ${active ? 'bv-condition-active' : ''} ${isCustom ? 'bv-condition-custom' : ''}`,
            });

            badge.addEventListener('click', () => {
                const isActive = badge.hasClass('bv-condition-active');
                const inst = this.ensureInstanceState(index);
                const conditions: string[] = Array.isArray(inst.conditions) ? [...inst.conditions] : [];

                if (isActive) {
                    inst.conditions = conditions.filter((c: string) => c !== condition);
                } else {
                    inst.conditions = [...conditions, condition];
                }
                this.plugin.updateState();
                badge.toggleClass('bv-condition-active', !isActive);
            });

            return badge;
        };

        for (const condition of allConditions) {
            addBadge(condition);
        }

        // "+" button for ad-hoc custom conditions
        const addBtn = condBar.createSpan({
            text: '+',
            cls: 'bv-condition-badge bv-condition-add',
        });
        addBtn.addEventListener('click', () => {
            const input = createEl('input', {
                type: 'text',
                cls: 'bv-condition-input',
                attr: { placeholder: 'Condition...' },
            });
            addBtn.replaceWith(input);
            input.focus();

            const commit = () => {
                const name = input.value.trim();
                if (name && !allConditions.includes(name)) {
                    const badge = addBadge(name);
                    allConditions.push(name);
                    // Auto-activate the new condition
                    badge.click();
                    input.replaceWith(addBtn);
                } else {
                    input.replaceWith(addBtn);
                }
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') input.replaceWith(addBtn);
            });
            input.addEventListener('blur', commit);
        });
    }

    createStatSlots(statBar: HTMLElement, name: string, stat: number, keys: (string | number)[], showControls = false) {
        const slots: HTMLInputElement[] = []
        const marked = this.plugin.getCardState(keys) ?? 0;
        if (stat > 0) {
            statBar.createSpan({ text: `${name}: ${stat} `, cls: "bv-muted" });
            for (let i = 0; i < stat; i++) {
                const slot = statBar.createEl('input', { type: 'checkbox', cls: 'bv-slot' });
                if (i < marked) {
                    slot.checked = true;
                }
                slots.push(slot);
            }

            const syncSlots = () => {
                const count = slots.reduce((sum, slot) => sum + (slot.checked ? 1 : 0), 0);
                this.plugin.updateCard(keys, count);
            };

            // Notify parent listeners (e.g. horde size) after programmatic changes
            const notifyChange = () => {
                if (slots.length > 0) slots[0].dispatchEvent(new Event('input', { bubbles: true }));
            };

            if (showControls) {
                const controls = statBar.createSpan({ cls: 'bv-slot-controls' });
                const minus = controls.createEl('button', { cls: 'bv-slot-btn', attr: { 'aria-label': `Remove 1 ${name}` } });
                const plus = controls.createEl('button', { cls: 'bv-slot-btn', attr: { 'aria-label': `Add 1 ${name}` } });
                const clear = controls.createEl('button', { cls: 'bv-slot-btn bv-slot-btn-clear', attr: { 'aria-label': `Clear ${name}` } });
                setIcon(minus, 'arrow-down');
                setIcon(plus, 'arrow-up');
                setIcon(clear, 'ban');

                plus.addEventListener('click', () => {
                    for (const slot of slots) {
                        if (!slot.checked) { slot.checked = true; break; }
                    }
                    syncSlots();
                    notifyChange();
                });

                minus.addEventListener('click', () => {
                    for (const slot of slots.toReversed()) {
                        if (slot.checked) { slot.checked = false; break; }
                    }
                    syncSlots();
                    notifyChange();
                });

                clear.addEventListener('click', () => {
                    for (const slot of slots) slot.checked = false;
                    syncSlots();
                    notifyChange();
                });
            }

            statBar.createEl('br');
            statBar.addEventListener('input', (event) => {
                if (!slots.contains(event.target as HTMLInputElement)) return;
                syncSlots();
            });
        }

        return slots;
    }

    createThresholdButtons(content: HTMLElement) {
        let minor, major, severe, massive;
        const effThresholds = this.getField('thresholds');
        if (effThresholds.length > 0) {
            const thresholds = content.createEl('p', { cls: 'bv-thresholds' });
            if (this.isOverridden('thresholds')) thresholds.addClass('bv-overridden');
            minor = thresholds.createEl('button', { text: 'MINOR', cls: 'bv-threshold-btn' });
            thresholds.createSpan({ text: ` ${effThresholds[0]} ` });
            major = thresholds.createEl('button', { text: 'MAJOR', cls: 'bv-threshold-btn' });
            if (effThresholds.length > 1) {
                thresholds.createSpan({ text: ` ${effThresholds[1]} ` });
                severe = thresholds.createEl('button', { text: 'SEVERE', cls: 'bv-threshold-btn' });
                if (this.plugin.state.settings.showMassiveThreshold) {
                    thresholds.createSpan({ text: ` ${effThresholds?.[2] || 2 * effThresholds[1]} ` });
                    massive = thresholds.createEl('button', { text: 'MASSIVE', cls: 'bv-threshold-btn' });
                }
            }
        }
        return [minor, major, severe, massive];
    }

    createStatBar(content: HTMLElement, index: number) {
        const statBar = content.createEl('p');

        // Build the per-instance reset button up front; placement depends on layout
        // (alongside the instance name when count>1, otherwise overlaid on the
        // threshold row so it sits on the same horizontal line as MINOR/MAJOR/SEVERE).
        const resetBtn = createEl('button', {
            cls: 'clickable-icon bv-instance-reset',
            attr: { 'aria-label': `Reset combat state for ${this.count > 1 ? `instance ${index + 1}` : 'this stat block'}` },
        });
        setIcon(resetBtn, 'rotate-ccw');
        resetBtn.addEventListener('click', () => {
            this.resetInstance(index);
            void this.render();
            this.plugin.updateStatusBar();
        });

        // Per-instance name + reset row (only when count > 1, otherwise the name slot
        // is empty and would just create vertical dead space)
        if (this.count > 1) {
            const headerRow = statBar.createDiv({ cls: 'bv-instance-row' });
            const nameSlot = headerRow.createDiv({ cls: 'bv-instance-row-name' });

            const cardState = this.plugin.state.cards[this.adv.id];
            const savedName = cardState?.[index]?.instanceName;
            const defaultName = `${this.adv.name || 'Instance'} ${index + 1}`;
            const displayName = savedName || defaultName;

            const nameEl = nameSlot.createEl('b', {
                text: displayName,
                cls: 'bv-instance-name',
            });

            nameEl.addEventListener('click', () => {
                const input = createEl('input', {
                    type: 'text',
                    value: displayName,
                    cls: 'bv-instance-name-input',
                });
                nameEl.replaceWith(input);
                input.focus();
                input.select();

                const commit = () => {
                    const newName = input.value.trim();
                    if (newName && newName !== displayName) {
                        this.ensureInstanceState(index).instanceName = newName;
                        this.plugin.updateState();
                    }
                    // Re-render to show updated name
                    void this.render();
                };

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') void this.render();
                });
                input.addEventListener('blur', commit);
            });

            headerRow.appendChild(resetBtn);
        }

        const [minor, major, severe, massive] = this.createThresholdButtons(statBar);

        // For single-instance cards, overlay the reset button on the threshold row so
        // it lands on the same horizontal line as MINOR/MAJOR/SEVERE.
        if (this.count === 1) {
            const thresholdRow = statBar.querySelector<HTMLElement>('.bv-thresholds');
            if (thresholdRow) {
                resetBtn.addClass('bv-instance-reset-overlay');
                thresholdRow.appendChild(resetBtn);
            } else {
                // No thresholds rendered (envs / unusual homebrew); fall back to a small
                // right-aligned standalone placement so the button stays reachable.
                const fallback = statBar.createDiv({ cls: 'bv-instance-row bv-instance-row-noname' });
                fallback.appendChild(resetBtn);
            }
        }

        const effHp = this.getField('hp');
        const effStress = this.getField('stress');
        const hpSlots = this.createStatSlots(statBar, 'HP', effHp, [this.adv.id, index, 'hp'], true);
        this.createStatSlots(statBar, 'Stress', effStress, [this.adv.id, index, 'stress'], true);

        // Condition badges for adversaries only (not environments)
        if (this.adv.hp || this.adv.stress) {
            this.createConditionBar(statBar, index);
        }

        if (this.count > 1) {
            for (const [featureIndex, feature] of this.adv.features.entries()) {
                const uses = feature.uses || 0;
                const name = feature.name || 'Unnamed feature uses';
                if (uses != 0) {
                    this.createStatSlots(statBar, name, uses, [this.adv.id, index, 'uses', featureIndex]);
                }
            }
        }

        let hordeSize: HTMLElement | null = null;
        let updateHordeSize: (() => void) | null = null;
        const match = this.adv.type?.match(/^horde\s+\((\d+)\/hp\)$/i);
        if (match && effHp > 0) {
            hordeSize = statBar.createSpan({ cls: "bv-muted" });
            updateHordeSize = () => {
                if (hordeSize == null) return;
                const size = parseInt(match[1]);
                const hp = this.plugin.getCardState([this.adv.id, index, 'hp']) ?? 0;
                const currentHP = effHp - hp;
                hordeSize.innerText = `Horde size: ${size * currentHP}`;
            };
            updateHordeSize();
            statBar.addEventListener('input', (event) => {
                if (!hpSlots.contains(event.target as HTMLInputElement)) return;
                updateHordeSize?.();
            })
        }

        const doMark = (x: number, reverse: boolean) => {
            const slots = reverse ? hpSlots.toReversed() : hpSlots;
            let toMark = x;
            let marked = 0;

            for (const slot of slots) {
                if (slot.checked == reverse && toMark > 0) {
                    slot.checked = !slot.checked;
                    toMark--
                }
                if (slot.checked) marked++;
            }
            this.plugin.updateCard([this.adv.id, index, 'hp'], marked)
            updateHordeSize?.();
        };

        const slotMarker = (x: number) => (event: MouseEvent) => {
            if (event.altKey) {
                doMark(x, true);
            } else if (Platform.isMobile) {
                const menu = new Menu();
                menu.addItem(item => item.setTitle('Mark damage').onClick(() => doMark(x, false)));
                menu.addItem(item => item.setTitle('Clear damage').onClick(() => doMark(x, true)));
                menu.showAtMouseEvent(event);
            } else {
                doMark(x, false);
            }
        };

        minor?.addEventListener('click', slotMarker(1));
        major?.addEventListener('click', slotMarker(2));
        severe?.addEventListener('click', slotMarker(3));
        massive?.addEventListener('click', slotMarker(4));
    }

    createPlusMinosButtons(card: HTMLElement, features: HTMLElement, statBlock: HTMLElement) {
        if (!this.adv.hp && !this.adv.stress) return;

        const edit = card.createEl('button', {
            cls: 'bv-top-corner clickable-icon bv-invisible',
            attr: { 'aria-label': 'Edit stat block overrides' },
        });
        setIcon(edit, 'pencil');
        if (this.getOverrides()) edit.addClass('bv-corner-edit-active');

        const add = card.createEl('button', {
            cls: 'bv-top-corner clickable-icon bv-invisible',
            attr: { 'aria-label': 'Increase adversary count' }
        })
        const remove = card.createEl('button', {
            cls: 'bv-top-corner clickable-icon bv-invisible',
            attr: { 'aria-label': 'Decrease adversary count' }
        })
        setIcon(add, 'plus')
        setIcon(remove, 'minus')

        // hacky but works for now
        window.setTimeout(() => {
            const editable = card.parentElement?.nextElementSibling?.classList.contains('edit-block-button');
            if (editable) {
                // Obsidian's edit-block-button takes the top slot
                edit.addClass('bv-lower-1');
                add.addClass('bv-lower-2');
                remove.addClass('bv-lower-3');
            } else {
                add.addClass('bv-lower-1');
                remove.addClass('bv-lower-2');
            }
            edit.removeClass('bv-invisible');
            add.removeClass('bv-invisible');
            remove.removeClass('bv-invisible');
        }, 5);

        const rerender = async () => {
            features.empty();
            statBlock.empty();
            await this.createFeaturesAndStats(features, statBlock);
            this.plugin.updateStatusBar();
        };

        edit.addEventListener('click', () => {
            new AdversaryEditModal(this.plugin.app, this, () => void this.render()).open();
        });

        add.addEventListener('click', () => {
            this.count += 1;
            this.plugin.updateCard([this.adv.id, 'count'], this.count);
            void rerender();
        });

        remove.addEventListener('click', () => {
            if (this.count > 1) {
                this.count -= 1;
                this.plugin.updateCard([this.adv.id, 'count'], this.count);
                void rerender();
            }
        });
    }

    async createFeaturesAndStats(features: HTMLElement, statBlock: HTMLElement) {
        const anyStats = this.adv.hp || this.adv.stress || this.adv.thresholds.length;
        if (this.adv.features.length > 0 || anyStats) {
            features.createEl('hr');
        }

        for (const [index, feature] of this.adv.features.entries()) {
            await this.createFeature(features, index, feature);
        }

        if (this.adv.features.length > 0 && anyStats) {
            features.createEl('hr')
        }

        for (let index = 0; index < this.count; index++) {
            if (index != 0) statBlock.createEl('hr');
            this.createStatBar(statBlock, index);
        }
    }

    async render() {
        this.container.empty();
        const card = this.container.createDiv({ cls: 'callout bv-statblock', attr: { 'data-callout': 'daggerheart-card' } });
        await this.createTitle(card);

        card.addEventListener('click', (event) => {
            const elt = event.target as HTMLElement;

            // "Mark a Stress" clickable action
            if (elt.classList.contains('bv-mark-stress')) {
                if (this.getField('stress') <= 0) return;
                if (this.count === 1) {
                    this.markStressOnInstance(0);
                } else {
                    const menu = new Menu();
                    for (let i = 0; i < this.count; i++) {
                        const cardState = this.plugin.state.cards[this.adv.id];
                        const savedName = cardState?.[i]?.instanceName;
                        const label = savedName || `${this.adv.name || 'Instance'} ${i + 1}`;
                        menu.addItem((item) => item
                            .setTitle(label)
                            .onClick(() => this.markStressOnInstance(i)));
                    }
                    menu.showAtMouseEvent(event);
                }
                return;
            }

            // Dice rolling (fallback when dice-roller plugin is not available)
            if (!elt.classList.contains('bv-rollable')) return;
            const dice = elt.classList.contains('bv-rollable-attack')
                ? `1d20${this.adv.attack == '0' ? '' : this.adv.attack}`
                : elt.innerText;
            const fragment = createFragment();
            fragment.createEl('code', { text: `${dice} = ${roll(dice).result}` });
            new Notice(fragment);
        });

        const content = card.createDiv({ cls: 'callout-content' });
        const header = content.createDiv();
        const features = content.createDiv();
        const statBlock = content.createDiv();

        await this.createHeader(header);
        await this.createFeaturesAndStats(features, statBlock);
        this.createPlusMinosButtons(card, features, statBlock);

        const data = this.plugin.state.cards[this.adv.id]?.color;
        const defaultColor = data || this.plugin.state.settings.defaultColor;

        const applyColor = (color: string) => {
            card.style.setProperty('--callout-color', hexToRgb(color));
            card.style.setProperty('--checkbox-color', color)
            card.style.setProperty('--checkbox-color-hover', color)
        }

        applyColor(defaultColor);

        const buttonColor = this.plugin.state.settings.statButtonColor;
        card.style.setProperty('--bv-button-color', buttonColor);
        card.style.setProperty('--bv-button-color-rgb', hexToRgb(buttonColor));

        if (this.plugin.state.settings.showColorPicker) {
            const colorpicker = card.createEl('input', { type: 'color', value: defaultColor, cls: 'bv-bottom-corner' });
            colorpicker.addEventListener('input', () => {
                applyColor(colorpicker.value);
                this.plugin.updateCard([this.adv.id, 'color'], colorpicker.value);
            })
        }
    }
}

function normalizeAttack(input: string): string | undefined {
    const trimmed = input.trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n > 0 ? `+${n}` : `${n}`;
    return trimmed;
}

function parseThresholds(input: string): number[] | undefined {
    const trimmed = input.trim();
    if (trimmed === '') return undefined;
    const parts = trimmed.split(/[,/]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    // Explicit "none" (matches the YAML parser convention) persists as an empty
    // override — distinct from blank input, which clears the override.
    if (parts.length > 0 && parts.every(p => p.toLowerCase() === 'none')) return [];
    const parsed = parts
        .filter(p => p.toLowerCase() !== 'none')
        .map(s => parseInt(s, 10))
        .filter(n => Number.isFinite(n));
    return parsed.length > 0 ? parsed : undefined;
}

function parsePositiveInt(input: string): number | undefined {
    const trimmed = input.trim();
    if (trimmed === '') return undefined;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export class AdversaryEditModal extends Modal {
    private overrides: InstanceOverrides;

    constructor(
        app: App,
        private card: AdversaryCard,
        private onChange: () => void,
    ) {
        super(app);
        this.overrides = { ...(this.card.getOverrides() ?? {}) };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bv-edit-modal');

        contentEl.createEl('h3', { text: `Edit ${this.card.adv.name || 'stat block'}` });
        contentEl.createEl('p', {
            text: 'Overrides are stored in plugin state and apply to every instance of this card. The library entry is untouched.',
            cls: 'bv-muted bv-smaller',
        });

        const grid = contentEl.createDiv({ cls: 'bv-edit-grid' });

        const addRow = <K extends keyof InstanceOverrides>(
            label: string,
            field: K,
            libraryValue: string,
            currentValueAsText: () => string,
            parseInput: (raw: string) => InstanceOverrides[K] | undefined,
        ) => {
            const row = grid.createDiv({ cls: 'bv-edit-row' });
            row.createEl('label', { text: label, cls: 'bv-edit-label' });
            const inputWrap = row.createDiv({ cls: 'bv-edit-input-wrap' });
            const input = inputWrap.createEl('input', {
                type: 'text',
                cls: 'bv-edit-input',
                value: currentValueAsText(),
                attr: { placeholder: libraryValue || '—' },
            });
            const resetBtn = inputWrap.createEl('button', {
                cls: 'bv-edit-reset',
                attr: { 'aria-label': `Reset ${label}` },
                text: '↺',
            });
            input.addEventListener('input', () => {
                const parsed = parseInput(input.value);
                if (parsed === undefined) {
                    delete this.overrides[field];
                } else {
                    this.overrides[field] = parsed;
                }
            });
            resetBtn.addEventListener('click', () => {
                input.value = '';
                delete this.overrides[field];
            });
        };

        const adv = this.card.adv;
        addRow('Max HP', 'hp',
            adv.hp ? String(adv.hp) : '',
            () => this.overrides.hp !== undefined ? String(this.overrides.hp) : '',
            (raw) => parsePositiveInt(raw));
        addRow('Max Stress', 'stress',
            adv.stress ? String(adv.stress) : '',
            () => this.overrides.stress !== undefined ? String(this.overrides.stress) : '',
            (raw) => parsePositiveInt(raw));
        addRow('Thresholds', 'thresholds',
            adv.thresholds.length > 0 ? adv.thresholds.join(', ') : 'none',
            () => {
                const t = this.overrides.thresholds;
                if (t === undefined) return '';
                return t.length === 0 ? 'none' : t.join(', ');
            },
            (raw) => parseThresholds(raw));
        addRow('Attack', 'attack',
            adv.attack ?? '',
            () => this.overrides.attack ?? '',
            (raw) => normalizeAttack(raw));
        addRow('Difficulty', 'difficulty',
            adv.difficulty ?? '',
            () => this.overrides.difficulty ?? '',
            (raw) => raw.trim() === '' ? undefined : raw.trim());
        addRow('Weapon', 'weapon',
            adv.weapon ?? '',
            () => this.overrides.weapon ?? '',
            (raw) => raw.trim() === '' ? undefined : raw.trim());
        addRow('Range', 'range',
            adv.range ?? '',
            () => this.overrides.range ?? '',
            (raw) => raw.trim() === '' ? undefined : raw.trim());
        addRow('Damage', 'damage',
            adv.damage ?? '',
            () => this.overrides.damage ?? '',
            (raw) => raw.trim() === '' ? undefined : raw.trim());
        addRow('Motives & Tactics', 'motives',
            adv.motives ?? '',
            () => this.overrides.motives ?? '',
            (raw) => raw.trim() === '' ? undefined : raw.trim());

        const footer = contentEl.createDiv({ cls: 'bv-edit-footer' });
        new Setting(footer)
            .addButton(btn => btn
                .setButtonText('Reset all customizations')
                .setDestructive()
                .onClick(() => {
                    this.card.resetOverrides();
                    this.onChange();
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(() => {
                    this.save();
                }));
    }

    private save() {
        // Build a full replacement: include current values, and use sentinel `undefined`
        // for any library-field the user didn't override. setOverrides treats undefined as "clear".
        const replacement: InstanceOverrides = {
            hp: undefined,
            stress: undefined,
            thresholds: undefined,
            attack: undefined,
            difficulty: undefined,
            weapon: undefined,
            damage: undefined,
            range: undefined,
            motives: undefined,
            ...this.overrides,
        };
        this.card.setOverrides(replacement);
        this.onChange();
        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
