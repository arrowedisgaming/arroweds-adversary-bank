import { App, PluginSettingTab, Setting } from 'obsidian';
import BeastVault from './main';
import { FolderPickerModal } from './ui';

export type PluginSettings = {
    defaultColor: string;
    statButtonColor: string;
    showColorPicker: boolean;
    showMassiveThreshold: boolean;
    numberOfPCs: number;
    libraryFolder?: string; // deprecated, migrated to libraryFolders
    libraryFolders: string[];
    ignoreDuplicateNames: boolean;
    hideBuiltInLibrary: boolean;
    compatibleWithFSB: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    showColorPicker: true,
    showMassiveThreshold: false,
    defaultColor: '#8A5CF5',
    statButtonColor: '#8A5CF5',
    numberOfPCs: 4,
    libraryFolders: [],
    ignoreDuplicateNames: true,
    hideBuiltInLibrary: false,
    compatibleWithFSB: false,
}

export class SettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: BeastVault) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName("Appearance").setHeading();

        new Setting(containerEl)
            .setName('Default color')
            .addColorPicker(color => color
                .setValue(this.plugin.state.settings.defaultColor)
                .onChange((value) => {
                    this.plugin.state.settings.defaultColor = value;
                    this.plugin.updateState();
                    this.plugin.renderAll();
                }));

        new Setting(containerEl)
            .setName('Stat block button color')
            .addColorPicker(color => color
                .setValue(this.plugin.state.settings.statButtonColor)
                .onChange((value) => {
                    this.plugin.state.settings.statButtonColor = value;
                    this.plugin.updateState();
                    this.plugin.renderAll();
                }));

        new Setting(containerEl)
            .setName('Show color picker')
            .addToggle(toggle => toggle
                .setValue(this.plugin.state.settings.showColorPicker)
                .onChange((value) => {
                    this.plugin.state.settings.showColorPicker = value;
                    this.plugin.updateState();
                    this.plugin.renderAll();
                }));

        new Setting(containerEl)
            .setName('Show the "massive" threshold button')
            .setDesc('Adds a 4th threshold button, for damage ≥ double the severe threshold')
            .addToggle(toggle => toggle
                .setValue(this.plugin.state.settings.showMassiveThreshold)
                .onChange((value) => {
                    this.plugin.state.settings.showMassiveThreshold = value;
                    this.plugin.updateState();
                    this.plugin.renderAll();
                }));

        new Setting(containerEl)
            .setName('Number of player characters')
            .setDesc('Used for battle points calculation in the status bar')
            .addSlider(slider => slider
                .setLimits(0, 10, 1)
                .setValue(this.plugin.state.settings.numberOfPCs)
                .setDynamicTooltip()
                .onChange((value) => {
                    this.plugin.state.settings.numberOfPCs = value;
                    this.plugin.updateState();
                    this.plugin.updateStatusBar();
                }));

        new Setting(containerEl).setName("Homebrew library").setHeading();

        const folderListEl = containerEl.createDiv({ cls: 'bv-selected-folders' });
        const renderFolderList = () => {
            folderListEl.empty();
            const folders = this.plugin.state.settings.libraryFolders;
            if (folders.length === 0) {
                folderListEl.createDiv({ text: 'No library folders selected', cls: 'setting-item-description' });
            } else {
                for (let i = 0; i < folders.length; i++) {
                    const row = new Setting(folderListEl)
                        .setName(folders[i])
                        .addExtraButton(button => button
                            .setIcon('trash')
                            .setTooltip('Remove this folder')
                            .onClick(() => {
                                this.plugin.state.settings.libraryFolders.splice(i, 1);
                                this.plugin.updateState();
                                renderFolderList();
                                void this.plugin.scanLibrary(false, 'conditional');
                            }));
                    row.nameEl.addClass('bv-folder-setting-name');
                }
            }
        };
        renderFolderList();

        new Setting(containerEl)
            .setName('Library folders')
            .setDesc('Adversaries from notes, JSON and YAML files in these folders will become available in search')
            .addButton(button => button
                .setButtonText('Choose folders')
                .setCta()
                .onClick(() => {
                    new FolderPickerModal(
                        this.app,
                        this.plugin.state.settings.libraryFolders,
                        (folders) => {
                            this.plugin.state.settings.libraryFolders = folders;
                            this.plugin.updateState();
                            renderFolderList();
                            void this.plugin.scanLibrary(false, 'conditional');
                        }
                    ).open();
                }));

        new Setting(containerEl)
            .setName('Ignore entries with duplicate names')
            .setDesc('If multiple adversaries share the same name, only the first one found will be used in search')
            .addToggle(toggle => toggle
                .setValue(this.plugin.state.settings.ignoreDuplicateNames)
                .onChange((value) => {
                    this.plugin.state.settings.ignoreDuplicateNames = value;
                    this.plugin.updateState();
                    void this.plugin.scanLibrary(false, 'no');
                }));

        new Setting(containerEl)
            .setName('Hide built-in library')
            .setDesc('Only show adversaries and environments from your homebrew library folders, hiding the built-in SRD entries')
            .addToggle(toggle => toggle
                .setValue(this.plugin.state.settings.hideBuiltInLibrary)
                .onChange((value) => {
                    this.plugin.state.settings.hideBuiltInLibrary = value;
                    this.plugin.updateState();
                }));

        new Setting(containerEl)
            .setName('Compatibility with Fantasy Statblocks')
            .setDesc('Any FSB-compatible statblocks in the notes inside the library folder will be also be available in search')
            .addToggle(toggle => toggle
                .setValue(this.plugin.state.settings.compatibleWithFSB)
                .onChange((value) => {
                    this.plugin.state.settings.compatibleWithFSB = value;
                    this.plugin.updateState();
                    void this.plugin.scanLibrary(false, 'no');
                }));
    }
}
