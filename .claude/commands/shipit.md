# /shipit — cut a new Arrowed's Adversary Bank release

End-to-end release flow for this Obsidian plugin. Use when you have a fix or
feature ready to publish to GitHub (and downstream, the Obsidian community
plugin directory, which pulls from GitHub releases).

**Trust contract:**
- The CI workflow at `.github/workflows/release.yml` owns the GitHub Release
  build, artifact attestations, and asset upload. It triggers on any tag
  matching `[0-9]+.[0-9]+.[0-9]+`. `/shipit` only needs to push a tag whose
  name matches `manifest.json`'s `version`. `scripts/verify-release-tag.mjs`
  enforces the match and fails the workflow if they disagree.
- Tag format is **bare** (`1.7.4`, no `v` prefix). One stale `v1.7.0` tag
  exists from before the convention was standardized — ignore it. Obsidian's
  community-plugin pipeline also expects bare versions, per the memory
  entry `project_release_tag_format.md`.
- Per the user's standing rule: **no AI attribution anywhere** that ships to
  GitHub — no `Co-Authored-By: Claude`, no "Generated with Claude" footers,
  no Claude mentions in commit messages, tag annotations, release notes,
  or issue comments. The memory entry `feedback_no_coauthored.md` is the
  canonical reference.

---

## Step 1 — Pre-flight

Establish the state you're shipping from.

```bash
git status --short
git diff --shortstat
git diff --shortstat --cached
jq -r .version manifest.json
git tag -l --sort=-version:refname | grep -E '^[0-9]' | head -3
gh auth status 2>&1 | grep -E '(account|Active account)'
```

Read `CHANGELOG.md` and locate the `[Unreleased]` block. If it is **empty**
(no bullets under any `### Added` / `### Changed` / `### Fixed` / `### Removed`
section), stop and tell the user there's nothing to ship — `/changelog` first.

If there are uncommitted changes that touch source files but `[Unreleased]`
doesn't reflect them, stop and tell the user to update the changelog first
(or run `/changelog`).

If `manifest.json`, `versions.json`, and `package.json` disagree on the
current version, stop and surface the discrepancy. They must all be in sync
before a new release can be cut.

## Step 2 — Parallel review (Codex + local code review)

Run both reviewers **in parallel** — single message with two tool calls.

### 2a. Codex review

```bash
node "/Users/edmundoneill/.claude/plugins/cache/openai-codex/codex/1.0.4/scripts/codex-companion.mjs" review ""
```

The current Codex companion maps `review` to the built-in reviewer and does
**not** accept custom focus text — pass an empty string. If you want a
focused brief, use the `adversarial-review` subcommand instead.

### 2b. Local code review

Dispatch the `feature-dev:code-reviewer` subagent against the working tree
and recent commits. Prompt should brief it on: the project is an Obsidian
plugin in TypeScript built with esbuild + pnpm; the user values strict
TypeScript and conservative defensive code; review the working-tree diff
plus any commits since the latest release tag for bugs, type unsafety,
Obsidian API misuse, and CHANGELOG/code drift.

### 2c. Combine findings

Once both return, dedupe their findings into a single prioritized list
(critical / important / nit). If both flag the same issue, mention it
once and note "flagged by both reviewers." If clean, proceed silently.

If issues were found, use AskUserQuestion:
- **Question:** "Review found N issues. How to proceed?"
- **Options:**
  - `Fix first (Recommended)` — attempt the fixes here, then re-run reviews on the patched tree before continuing.
  - `Ship anyway` — note the deferred issues and proceed to Step 3.
  - `Abort` — stop without making any changes.

If "Fix first," fix the issues, then re-run Step 2 once. Do not loop more
than twice; if the second review still has criticals, escalate to the user
with a plain question rather than continuing to auto-fix.

## Step 3 — Compute the next version

Read `[Unreleased]` and apply this heuristic:

| What's in `[Unreleased]`                              | Bump  |
| ----------------------------------------------------- | ----- |
| Only `### Fixed` (and/or `### Security`)              | patch |
| Any `### Added` or `### Changed`                      | minor |
| Anything in `### Removed`, or text marked "BREAKING"  | major |

Compute the proposed version (`current = $(jq -r .version manifest.json)` →
parse `MAJOR.MINOR.PATCH`, apply the bump). Hold this as the candidate; the
user gets to override at the confirmation step.

## Step 4 — Local verification (mirrors CI)

Run the same check CI runs before it agrees to publish:

```bash
pnpm run check
```

This is `typecheck` + `lint:ts` + `lint:css` + production `build`. If it
fails, **stop** — do not draft a release. Attempt the fix (or hand the
error back to the user if it's not mechanical) and re-run before moving on.

The output `main.js` and existing `styles.css` are what will be attached
to the GitHub Release by CI. No need to commit them — they're rebuilt by
the workflow from source.

## Step 5 — Draft all artifacts (do NOT apply yet)

Build a single confirmation packet containing:

### 5a. `manifest.json` version bump

```
"version": "<old>",  →  "version": "<new>",
```

`scripts/verify-release-tag.mjs` (run inside CI) reads this field and
fails the workflow if the tag doesn't match — get it right here.

### 5b. `versions.json` new entry

Append a new key-value pair to the JSON object, keeping `minAppVersion` set
to whatever `manifest.json` says (currently `1.9.14`):

```
"<new>": "<minAppVersion>"
```

This is the file Obsidian's community-plugin pipeline reads to figure out
compatibility for users on older Obsidian versions.

### 5c. `package.json` version bump

```
"version": "<old>",  →  "version": "<new>",
```

Kept in sync with `manifest.json` purely as a convention — nothing reads
it for the release, but historical commits keep them paired.

### 5d. `CHANGELOG.md` promotion diff

Promote `[Unreleased]` to `[<new>] - <today YYYY-MM-DD>`. Use today's
actual date (`date +%Y-%m-%d`). Insert a fresh empty `[Unreleased]` block
above the new versioned entry so the next `/changelog` run has a place to
land.

The release workflow passes the full `CHANGELOG.md` as the GitHub Release
notes (`--notes-file CHANGELOG.md`), so every release page ships the
**entire** changelog — every historical entry — not just the new block.
That's the project's current convention; don't try to trim it here. The
formatting matters because everything in this file ends up on the release
page.

### 5e. Commit message

Use the project's established voice — the last four release commits all
read `chore: prepare <X.Y.Z> release`. Prefer:

```
chore: prepare <new> release
```

If there's a single dominant fix worth surfacing in the subject:

```
fix: <short summary>; prepare <new> release
```

**No Claude attribution. No Co-Authored-By Claude. No "Generated with"
footers.**

### 5f. Tag

Tag name: **bare** `<new>` (e.g. `1.7.5`), matching the CI trigger pattern
`[0-9]+.[0-9]+.[0-9]+` in `.github/workflows/release.yml`. Annotated tag
with message `Arrowed's Adversary Bank <new>`.

### 5g. GitHub Release notes

CI auto-creates the release using `CHANGELOG.md` as the body when the tag
is pushed. Note this in the packet so the user knows nothing extra is
drafted here.

### 5h. Issue comments (if applicable)

Parse the new versioned changelog block for GitHub close-keyword
references — `Fixes #N`, `Closes #N`, `Resolves #N` — and also the
markdown-link form (`Fixes [#N](...)`). For each issue number found,
draft a comment:

```
Shipped in [<new>](https://github.com/arrowedisgaming/arroweds-adversary-bank/releases/tag/<new>). Thanks for the report!
```

If no issue refs are present, skip this section. Keep comments terse —
one line of plain text, no headers, no AI attribution.

## Step 6 — Confirmation

Present the packet to the user via a single AskUserQuestion call:

- **Question:** "Ship `<new>`?"
- **Options:**
  - `Ship it (Recommended)` — proceed with the drafted artifacts as-is.
  - `Override version` — let user pick a different version.
  - `Edit artifacts` — let user edit one or more drafts before shipping.
  - `Abort` — cancel without making any changes.

If the user picks "Override" or "Edit," loop back to Step 5 with the
corrections, then re-confirm.

## Step 7 — Apply, commit, tag, push

Only after explicit confirmation:

```bash
# 1. Apply file edits (use Edit tool, not sed — preserves formatting reliably)
#    - manifest.json: bump version
#    - versions.json: add new entry
#    - package.json: bump version
#    - CHANGELOG.md: promote [Unreleased] → [<new>] - <date>, add fresh [Unreleased]

# 2. Stage version files, changelog, AND any working-tree files the new
#    [Unreleased] entry claims to ship (e.g. README rewrites, new assets
#    under docs/, tooling under .claude/commands/). Walk the [Unreleased]
#    block, identify referenced paths, and `git add` them. If the changelog
#    mentions a file that does not exist on disk, stop and surface the gap.
git add manifest.json versions.json package.json CHANGELOG.md
# git add <other files referenced by the new [Unreleased] entry>

# 3. Commit (no --no-verify, no --amend, no Claude attribution)
git commit -m "chore: prepare <new> release"

# 4. Annotated tag — bare version, NO v prefix
git tag -a "<new>" -m "Arrowed's Adversary Bank <new>"

# 5. Push commit and tag together
git push origin main --follow-tags
```

If any step fails, **stop**. Do not retry destructively. Surface the error
to the user and ask how to proceed. Common failures:
- Pre-commit hook rejection → fix and retry with a NEW commit (not --amend).
- Tag already exists → user picked a version that was previously released;
  abort and ask for a different version.
- Push rejected (non-fast-forward) → someone pushed in between; tell user
  to pull/rebase manually before retrying.

## Step 8 — Watch CI

```bash
# Confirm the release workflow started
gh run list --workflow=release.yml --limit 1

# Show the user the run URL so they can watch the asset-upload step
gh run view --web
```

If `gh run list` shows the run is still queued or in-progress, note that
the artifact attestations and asset upload take a couple of minutes. Don't
block on it — surface the URL and move on.

## Step 9 — Post issue comments

If Step 5h produced any drafts, post them now:

```bash
gh issue comment <N> --repo arrowedisgaming/arroweds-adversary-bank --body "<drafted text>"
```

## Step 10 — Final report

Tell the user:
- The new version, tag, and commit SHA.
- The GitHub Release URL: `https://github.com/arrowedisgaming/arroweds-adversary-bank/releases/tag/<new>`.
- The CI run URL.
- Which issues got comments (if any).
- A reminder that the Obsidian community-plugin directory polls GitHub
  releases on its own schedule, so the new version may take up to a few
  hours to appear in the in-app browser. The direct release URL works
  immediately for BRAT users.

Do **not** narrate every step in the final report — keep it to the deltas
that matter to the user and links they might want to click.
