# Changelog — Arrowed's Adversary Bank

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.5.0] - 2026-04-04

### Added

- Multiple library folder support — add as many homebrew folder paths as you need in settings, each scanned independently for adversary YAML/JSON/MD files
- Folder picker modal — click "Choose folders" to visually browse and select vault folders with search and checkboxes, replacing the old single text field
- Frontmatter adversary loading — markdown notes with adversary stats in YAML frontmatter (name, hp, stress, difficulty, etc.) are now recognized as library entries, with field mapping for common third-party formats (role→type, atk_bonus→attack, weapon_name→weapon, etc.)

## [1.4.0] - 2026-04-04

### Added

- Dice-roller plugin integration — when [dice-roller](https://github.com/Obsidian-TTRPG-Community/dice-roller) is installed, dice formulas in statblocks (attack, damage, feature descriptions) render as interactive dice-roller elements with tooltips and click-to-reroll

### Fixed

- Dice pattern regex `lastIndex` bug that could cause alternating match failures on damage strings

## [1.3.0] - 2026-04-03

Forked from [BeastVault](https://github.com/ly0va/beastvault) 1.2.3 by Lyova Potyomkin.

### Added

- Auto-suffix duplicate adversary names on insert (e.g. "Bladed Guard 2", "Bladed Guard 3")
- Inline rename on rendered adversary cards (double-click the name to edit)
- Condition tracking badges per adversary instance (Vulnerable, Restrained, Frightened, Disoriented, Weakened, Hidden, Empowered, Slowed)
- Custom conditions via YAML `conditions` field and ad-hoc "+" button on condition bar
- Per-instance naming for multi-count adversaries (click to rename "Chimera 1", "Chimera 2", etc.)
- Clickable "Mark a Stress" text in feature descriptions — auto-marks stress on single instances, shows picker for multi-count
- Per-stat +/- and clear buttons for HP and Stress slot rows
- Summon buttons on features with a `summon` field — inserts the named adversary at end of document

### Fixed

- Removed unnecessary type assertions flagged by Obsidian eslint plugin
- Replaced `as any` casts with proper typed access to card/instance state

## [1.2.3] - 2025-11-30

### Note

Last upstream release from original BeastVault. See [upstream repository](https://github.com/ly0va/beastvault) for prior history.
