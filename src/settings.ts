import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
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

/** Keys a declarative setting control may bind to. */
type SettingKey = keyof PluginSettings;

/** Indexed view of the settings object, for the key-addressed control API. */
type SettingsRecord = Record<SettingKey, unknown>;

export class SettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: BeastVault) {
        super(app, plugin);
    }

    getControlValue(key: string): unknown {
        return (this.plugin.state.settings as SettingsRecord)[key as SettingKey];
    }

    setControlValue(key: string, value: unknown): void {
        (this.plugin.state.settings as SettingsRecord)[key as SettingKey] = value;
        this.plugin.updateState();
        this.afterChange(key as SettingKey);
    }

    /** Side effects to run after a setting changes, beyond persisting it. */
    private afterChange(key: SettingKey): void {
        switch (key) {
            case 'defaultColor':
            case 'statButtonColor':
            case 'showColorPicker':
            case 'showMassiveThreshold':
                this.plugin.renderAll();
                break;
            case 'numberOfPCs':
                this.plugin.updateStatusBar();
                break;
            case 'ignoreDuplicateNames':
            case 'compatibleWithFSB':
                void this.plugin.scanLibrary(false, 'no');
                break;
        }
    }

    private setLibraryFolders(folders: string[]): void {
        this.plugin.state.settings.libraryFolders = folders;
        this.plugin.updateState();
        this.update();
        void this.plugin.scanLibrary(false, 'conditional');
    }

    private openFolderPicker(): void {
        new FolderPickerModal(
            this.app,
            this.plugin.state.settings.libraryFolders,
            folders => this.setLibraryFolders(folders)
        ).open();
    }

    getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
        const settings = this.plugin.state.settings;

        return [
            {
                type: 'group',
                heading: 'Appearance',
                items: [
                    {
                        name: 'Default color',
                        control: { type: 'color', key: 'defaultColor', defaultValue: DEFAULT_SETTINGS.defaultColor },
                    },
                    {
                        name: 'Stat block button color',
                        control: { type: 'color', key: 'statButtonColor', defaultValue: DEFAULT_SETTINGS.statButtonColor },
                    },
                    {
                        name: 'Show color picker',
                        control: { type: 'toggle', key: 'showColorPicker', defaultValue: DEFAULT_SETTINGS.showColorPicker },
                    },
                    {
                        name: 'Show the "massive" threshold button',
                        desc: 'Adds a 4th threshold button, for damage ≥ double the severe threshold',
                        control: { type: 'toggle', key: 'showMassiveThreshold', defaultValue: DEFAULT_SETTINGS.showMassiveThreshold },
                    },
                    {
                        name: 'Number of player characters',
                        desc: 'Used for battle points calculation in the status bar',
                        control: {
                            type: 'slider',
                            key: 'numberOfPCs',
                            min: 0,
                            max: 10,
                            step: 1,
                            defaultValue: DEFAULT_SETTINGS.numberOfPCs,
                        },
                    },
                ],
            },
            {
                type: 'list',
                heading: 'Library folders',
                cls: 'bv-selected-folders',
                emptyState: 'No library folders selected',
                items: settings.libraryFolders.map(folder => ({
                    name: folder,
                    aliases: ['library folder', 'homebrew'],
                })),
                onDelete: (index: number) => {
                    const folders = [...settings.libraryFolders];
                    folders.splice(index, 1);
                    this.setLibraryFolders(folders);
                },
                addItem: {
                    name: 'Choose folders',
                    action: () => this.openFolderPicker(),
                },
            },
            {
                // The list's addItem affordance is deliberately excluded from
                // settings search, so this row carries the description and keeps
                // folder configuration findable — including when the list is empty.
                name: 'Library folders',
                desc: 'Adversaries from notes, JSON and YAML files in these folders will become available in search',
                aliases: ['homebrew', 'choose folders'],
                action: () => this.openFolderPicker(),
            },
            {
                type: 'group',
                heading: 'Homebrew library',
                items: [
                    {
                        name: 'Ignore entries with duplicate names',
                        desc: 'If multiple adversaries share the same name, only the first one found will be used in search',
                        control: { type: 'toggle', key: 'ignoreDuplicateNames', defaultValue: DEFAULT_SETTINGS.ignoreDuplicateNames },
                    },
                    {
                        name: 'Hide built-in library',
                        desc: 'Only show adversaries and environments from your homebrew library folders, hiding the built-in SRD entries',
                        control: { type: 'toggle', key: 'hideBuiltInLibrary', defaultValue: DEFAULT_SETTINGS.hideBuiltInLibrary },
                    },
                    {
                        name: 'Compatibility with Fantasy Statblocks',
                        desc: 'Any FSB-compatible statblocks in the notes inside the library folder will be also be available in search',
                        control: { type: 'toggle', key: 'compatibleWithFSB', defaultValue: DEFAULT_SETTINGS.compatibleWithFSB },
                    },
                ],
            },
        ];
    }
}
