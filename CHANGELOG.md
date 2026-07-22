# Changelog — Arroweds Adversary Bank

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.9.0] - 2026-07-22

### Added

- Markdown in every text property, not just feature `desc` ([#1](https://github.com/arrowedisgaming/arroweds-adversary-bank/issues/1)). `name`, `desc`, `weapon`, `range`, `damage`, `difficulty`, `xp`, `motives`, `tone`, `impulses`, `adversaries`, and a feature's `name`, `type`, and `flavor` now render through Obsidian's markdown pipeline, so `**bold**`, `*italic*`, `==highlight==`, `` `code` ``, `[[wikilinks]]`, and `#tags` work anywhere on a stat block. Fields with no markdown characters skip the renderer entirely, so cards with plain text render exactly as before. Markdown in `damage` may wrap dice notation (`"*2d6 magic*"`) and still produce a working roller. Inline rename edits the raw YAML value and now quotes it when the name needs quoting, so renaming a card to `**Wolf**` no longer writes invalid YAML.

### Changed

- Builds can now mirror `main.js`, `manifest.json`, and `styles.css` into a local Obsidian vault's plugin folder, so changes are testable in the real app without a manual copy. Point `.dev-vault` (gitignored) or `$OBSIDIAN_PLUGIN_DIR` at the folder; `pnpm dev` additionally watches `styles.css` and `manifest.json`, which esbuild does not rebuild. Syncing is opt-in and validates that the target path ends in `.obsidian/plugins/<plugin id>` before writing, so CI and fresh clones are unaffected.

### Fixed

- Relative links and dice in a stat block now resolve against the note the code block actually lives in, rather than whichever note happens to be active. Cards rendered in an embed, in a canvas, or in the background previously resolved links against the wrong file. Stat block ids are still derived from the active file, so tracked HP, stress, and conditions are unaffected.

- Dice rollers rendered by the dice-roller plugin sat below the baseline of the text around them, most visibly inside feature descriptions. The plugin's `.dice-roller` is an `inline-flex` box that vertically centers its contents around an 18px dice icon and then top-aligns itself in the line; against a stat block's smaller body text that pushed the formula about 1.5px low. Stat block dice are now laid out as plain inline text on the shared baseline, with the icon scaled to the surrounding font size.

## [1.8.1] - 2026-05-27

### Changed

- Renamed plugin to "Arroweds Adversary Bank" (removed the apostrophe from "Arrowed's") to comply with Obsidian community directory naming guidelines, which prohibit punctuation other than hyphens. The plugin `id` (`arroweds-adversary-bank`) is unchanged, so existing installs keep all settings, customizations, and tracked instance state.

## [1.8.0] - 2026-05-14

### Added

- Stat block overrides. Each rendered adversary card has a pencil icon in the top-right corner that opens an edit modal for adjusting Max HP, Max Stress, Thresholds, Attack, Difficulty, Weapon, Range, Damage, and Motives & Tactics mid-session without editing the YAML in the code block. Overrides are stored in plugin state — the library entry is never mutated — and survive vault reloads. Overridden values replace the library values in-place in the card header and are marked with a dotted underline. HP/Stress marks are clamped across all instances when the effective max drops (either by setting a lower override or by clearing an override that previously raised the max). A "Reset all customizations" button in the modal footer reverts every overridden field back to the library value.
- Per-instance reset button. Each instance's stat bar has a small reset icon at the top-right that clears that instance's HP marks, stress marks, conditions, feature uses, and feature countdowns. Customizations stay intact (they reset only from inside the edit modal), so a GM can fully refresh one creature in a multi-instance encounter without disturbing the rest.

## [1.7.5] - 2026-05-13

### Changed

- Rewrote `README.md` to lead with GM-facing utility rather than fork-vs-original framing: replaced the "What's New" / "Original BeastVault Features" split with a single Features section organized around library, live tracking, and interactive stat blocks; added hero and per-feature screenshots under `docs/images/`; reduced Installation to a single sentence pointing at the Obsidian community plugin directory; removed the BRAT install option; moved manual install and release-provenance instructions into collapsed `<details>` blocks below the Reference section. BeastVault attribution preserved in the Attributions section per the MIT License.

## [1.7.4] - 2026-05-12

### Fixed

- Replaced boolean `.every()` callbacks in `asStringOrStringArray` and `asThresholds` (`src/utils.ts`) with type-predicate callbacks so `Array.isArray` narrowing flows through to the return value, eliminating two `@typescript-eslint/no-unsafe-return` warnings.

## [1.7.3] - 2026-05-12

### Fixed

- Release tag format now matches the manifest version exactly (e.g. `1.7.3`, not `v1.7.3`), per the repo's existing convention and Obsidian's plugin guidelines. Updated the release workflow trigger and tag-verification accordingly. The previous `v1.7.2` tag and release were removed; this metadata-only `1.7.3` republishes the same content under the correct tag.

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
