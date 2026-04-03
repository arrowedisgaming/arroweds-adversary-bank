# Arrowed's Adversary Bank

An [Obsidian.md](https://obsidian.md) plugin for Daggerheart TTRPG GMs to search, edit, and create adversary & environment stat blocks with enhanced encounter management.

**A fork of [BeastVault](https://github.com/ly0va/beastvault) by [Lyova Potyomkin](https://github.com/ly0va)**, with additional features for running encounters at the table.

## What's New (over BeastVault)

- **Adversary Renaming** — auto-suffix duplicate names on insert ("Bladed Guard 2", "Bladed Guard 3"), plus double-click any rendered name to rename it inline
- **Instance Naming** — when running multiple copies of an adversary, each instance gets a label you can click to customize ("Left Chimera", "Wounded One")
- **Condition Tracking** — toggle Daggerheart conditions (Vulnerable, Restrained, Frightened, etc.) per instance, with support for custom conditions via YAML or the "+" button
- **Summon Buttons** — features with a `summon` field get a button that inserts the referenced adversary into the document
- **Clickable "Mark a Stress"** — the text in feature descriptions becomes an interactive button; for multi-instance adversaries, a picker lets you choose which one takes the stress
- **HP/Stress Controls** — +, -, and clear buttons on every HP and Stress row for quick adjustments

## Original BeastVault Features

All original BeastVault features are fully preserved:

- Search and insert adversaries & environments from the SRD via commands
- Render editable stat blocks with intuitive UI
- Roll dice for attack or damage with one click
- Track marked HP, stress, countdowns and feature uses
- Battle points counted in the status bar
- Customizable colors for any theme
- Works in a canvas for [FCG](https://freshcutgrass.app)-style encounter building
- Local homebrew library support with folder scanning
- FSB (Fantasy Statblocks) compatibility

## Installation

### Manual

1. Go to the [latest release](https://github.com/arrowedisgaming/arroweds-adversary-bank/releases/latest)
2. Download `main.js`, `manifest.json` and `styles.css`
3. Inside your Obsidian vault, create folder `.obsidian/plugins/arroweds-adversary-bank`
4. Copy the downloaded files to this folder
5. If Obsidian was open, restart it
6. Navigate to `Settings` > `Community plugins` and enable Arrowed's Adversary Bank

### Via [BRAT](https://github.com/TfTHacker/obsidian42-brat)

1. Install the [BRAT](obsidian://show-plugin?id=obsidian42-brat) plugin from the community plugins browser
2. Navigate to BRAT settings and click `Add beta plugin`
3. Enter `arrowedisgaming/arroweds-adversary-bank` as the repository and click `Add plugin`

## Usage

### Insert from Library

Insert an adversary via a command: `Ctrl+P` > `Insert adversary from library`, or use the side ribbon menu (sword icon).

> [!TIP]
> Bind plugin commands to hotkeys from the Hotkeys settings tab.
> For example, `Alt+A` for adversaries and `Alt+E` for environments.

> [!TIP]
> `Click` threshold buttons to mark the corresponding amount of HP. Use `Alt+Click` to clear it instead.

### Renaming

- **Auto-suffix:** Inserting the same adversary twice auto-names them "Bladed Guard" and "Bladed Guard 2"
- **Inline rename:** Double-click the adversary name on a rendered card to edit it. Press Enter to save, Escape to cancel.
- **Instance names:** When you have 2+ copies (via the +/- buttons), each instance's stat bar shows a clickable name label. Click to customize it.

### Conditions

Below each instance's HP and Stress slots, you'll see condition badges for the 8 standard Daggerheart conditions. Click to toggle.

**Custom conditions** can be added two ways:
1. In the YAML: add a `conditions` field with a list of custom condition names
2. At runtime: click the `+` button on the condition bar, type a name, press Enter

```yaml
name: Chimera
hp: 9
stress: 5
conditions:
  - Poisoned
  - Burning
```

### Summon Buttons

Add a `summon` field to any feature to get a button that inserts the named adversary:

```yaml
features:
- name: Raise Dead
  type: Action
  desc: The Necromancer raises skeletal warriors.
  summon:
    - Skeleton Warrior
    - Skeleton Archer
```

### HP/Stress Controls

Each HP and Stress row has inline buttons:
- **-** removes one mark
- **+** adds one mark
- **x** clears all marks

## Reference

The `daggerheart` code block parses the adversary or environment as [YAML](https://yaml.org) with the following properties:

| Property | Definition | Example |
| --- | --- | --- |
| `name` | Name of the adversary | `Bear` |
| `tier` | Adversary tier | `1` |
| `type` | Type of the adversary | `Bruiser` |
| `desc` | Adversary description | `A large bear with thick fur and powerful claws.` |
| `difficulty` | Adversary difficulty | `14` |
| `weapon` | Name of the adversary's weapon | `Claws` |
| `range` | Range of the adversary's weapon | `Close` |
| `damage` | Amount and type of adversary's weapon damage | `1d8+3 phy` |
| `hp` | Total adversary hitpoint slots | `6` |
| `stress` | Total adversary stress slots | `3` |
| `thresholds` | Adversary thresholds, separated by a `/`; leave blank for minions with 1 HP | `9/17` |
| `attack` | Adversary attack bonus; click to roll for attack | `+1` |
| `xp` | Adversary experiences | `Ambusher +2, Keen Senses +3` |
| `motives` | Adversary's motives and tactics | `Climb, defend territory, pummel, track` |
| `conditions` | Custom condition names for this adversary | `Poisoned, Burning` |
| `features` | List of feature objects, see table below | |
| `id` | Stat block id for state tracking; auto-generated, can be any random string | `a2sd4vsf` |

`features` properties:

| Property | Definition | Example |
| --- | --- | --- |
| `name` | Name of the feature | `Relentless (2)` |
| `type` | Feature type | `Passive` |
| `desc` | Feature description; supports markdown | `Make a standard attack. On a success, the target is *Vulnerable* until they next act.` |
| `uses` | Uses per scene | `2` |
| `countdown` | Size of the countdown | `6` |
| `flavor` | Hints for GM/PCs | `Have any of the PCs forded rivers like this before?` |
| `summon` | Adversary name(s) to summon | `Skeleton Warrior` or a YAML list |

For environments, `weapon`, `damage`, `range`, `hp`, `stress`, `thresholds`, `attack`, `xp`, `motives` are not set.
Instead, additional properties are available:

| Property | Definition | Example |
| --- | --- | --- |
| `impulses` | Environment impulses | `Bar crossing, carry away the unready, divide the land` |
| `adversaries` | Potential adversaries in an environment | `Guards, Masked Thief, Merchant` |
| `tone` | Tone and feel of the environment | `Musty and mournful, serene yet slightly wrong` |

All properties are optional and simply won't render if skipped.

> [!IMPORTANT]
> Do not use `TAB` in stat blocks. The indents for features must be manually indented with spaces.

## Attributions

This plugin is a fork of [BeastVault](https://github.com/ly0va/beastvault) by [Lyova Potyomkin](https://github.com/ly0va), licensed under the [MIT License](LICENSE). The original BeastVault was inspired by [FreshCutGrass](https://freshcutgrass.app) and [DaggerForge](https://github.com/Torutu/daggerforge).

### Copyright Notice

This plugin includes materials from the Daggerheart System Reference Document 1.0, (c) Critical Role, LLC. All rights reserved.

Public Game Content created and owned by Darrington Press, LLC. Available at https://www.daggerheart.com.

Licensed under the Darrington Press Community Gaming License: https://darringtonpress.com/license/.

Stat blocks may have minor edits to correct obvious errors.
