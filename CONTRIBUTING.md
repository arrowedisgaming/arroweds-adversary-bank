# Contributing to Arroweds Adversary Bank

Bug reports, feature ideas, and pull requests are all welcome.

## Reporting bugs and requesting features

Open an [issue](https://github.com/arrowedisgaming/arroweds-adversary-bank/issues). For bugs, please include:

- your Obsidian version and the plugin version
- the `daggerheart` code block (or library note) that triggers the problem
- what you expected to happen and what happened instead

## Development setup

You need Node 22 or newer and [pnpm](https://pnpm.io) (`corepack enable` will pick up the pinned version).

```bash
pnpm install
pnpm dev     # rebuild on change
pnpm check   # typecheck, lint, production build
```

See [Local development](README.md#local-development) in the README for how to build straight into a test vault.

## Pull requests

- Branch from `main` and keep each pull request to one change.
- Run `pnpm check` before pushing. CI runs the same command, and it must pass with no lint warnings.
- Add an entry under `## [Unreleased]` in `CHANGELOG.md`, following [Keep a Changelog](https://keepachangelog.com/).
- Don't commit `main.js`, and don't bump the version in `manifest.json`, `package.json`, or `versions.json`. Releases are cut by the maintainer.

## Code guidelines

The lint config includes `eslint-plugin-obsidianmd`, which enforces Obsidian's plugin guidelines. In short:

- Build DOM with Obsidian's helpers (`createEl`, `createDiv`, `createSpan`), never `innerHTML`.
- Put styling in `styles.css` with `bv-` prefixed classes rather than inline styles.
- Store data through the plugin's state (`loadData` / `saveData`), not browser storage.
- UI text uses sentence case.

## Adversary and environment data

The built-in library lives in `data/adversaries.json` and `data/environments.json`. Entries follow the same fields as a `daggerheart` code block (see the [Reference](README.md#reference) section of the README). When adding entries:

- Only include content released under the Daggerheart SRD, and set `source` to identify where it comes from.
- Match the existing formatting: names in upper case, `thresholds` as `"major/severe"`, damage as dice notation followed by the damage type.
- Check a few of your entries in Obsidian by inserting them from the library.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
