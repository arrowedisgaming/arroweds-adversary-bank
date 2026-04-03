# Changelog — Arrowed's Adversary Bank

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

## [1.2.3] - 2025-11-30

### Note

Last upstream release from original BeastVault. See [upstream repository](https://github.com/ly0va/beastvault) for prior history.
