# Changelog — Arrowed's Adversary Bank

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.7.2] - 2026-05-12

### Changed

- Added GitHub Actions release automation that builds release assets in CI, generates GitHub artifact attestations, and uploads `main.js`, `manifest.json`, and `styles.css`.
- Added local and CI checks for TypeScript, Obsidian ESLint rules, and CSS review guardrails.

### Fixed

- Replaced deprecated `builtin-modules` dependency usage with the native Node.js module list already used by the build.
- Tightened YAML, JSON, frontmatter, Fantasy Statblocks, dice-roller, and saved-state typing to avoid unsafe `any` flows.
- Marked intentional fire-and-forget promises, improved popout-window compatibility, and removed unused imports.
- Reworked CSS underlines and overrides to avoid unsupported `text-decoration` declarations and `!important`.
- Preserved brand-name and acronym capitalization (`Arrowed's Adversary Bank`, `Fantasy Statblocks`, `FSB`, `SRD`) in user-facing settings and ribbon labels by extending the sentence-case lint allowlist.
- Continued to accept quoted numeric stat fields (e.g. `hp: "8"`) in homebrew YAML, JSON, and frontmatter, restoring parity with prior loose-typed behavior.

## [1.7.1] - 2026-05-12

### Fixed

- Metadata-only release to align the Obsidian plugin manifest version with the Git tag name.

## [1.7.0] - 2026-05-04

### Added

- Configurable stat block button color for threshold and HP/Stress controls.

### Changed

- Restyled embedded stat block buttons with softer themed backgrounds, centered labels, and larger HP/Stress icon controls.

## [1.6.0] - 2026-04-12

### Added

- Mobile support — plugin now installs and runs on Obsidian Mobile (iOS/Android)
- Touch-friendly interactions: long-press to rename adversary titles, mark/clear damage menu on threshold buttons
- `:active` CSS states on all interactive elements for touch press feedback

## [1.5.1] - 2026-04-04

### Added

- "Hide built-in library" setting — optionally hide the bundled SRD adversaries and environments from the search modal, showing only your homebrew entries
- Markdown body parsing for frontmatter-based entries — description, motives & tactics, experience, and features are now extracted from the note body when not present in frontmatter

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
