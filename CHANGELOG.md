# Changelog

## [1.1.0](https://github.com/mfozmen/watchdown/compare/v1.0.0...v1.1.0) (2026-10-19)


### Features

* add editor, split, and preview layout toggle ([#55](https://github.com/mfozmen/watchdown/issues/55)) ([3021a89](https://github.com/mfozmen/watchdown/commit/3021a89e902e20c09b2355b2cb62a657d8b182b5))
* check github releases for updates on launch and from the help menu ([#54](https://github.com/mfozmen/watchdown/issues/54)) ([5c9d876](https://github.com/mfozmen/watchdown/commit/5c9d87613bd4e3a1cf19ace7c605c93b015eb79d))


### Bug Fixes

* resolve sonar findings ([3300eb3](https://github.com/mfozmen/watchdown/commit/3300eb3a65fccca2203151e205cfebb397ccaefa))

## 1.0.0 (2026-07-09)

The first release of Watchdown — a cross-platform desktop Markdown editor whose defining feature
is **live external-edit sync**.

### Live external-edit sync

- Edits made to the open file by any other program appear **instantly** — with no unsaved changes
  the reload is silent and preserves your cursor and scroll.
- With unsaved edits, an external change is reconciled by a git-style **3-way merge**: disjoint
  changes auto-merge, genuine overlaps become a non-destructive conflict with an interactive
  per-hunk resolver (keep mine / theirs / both), and saving is blocked until you resolve so neither
  side is dropped.
- Rapid write bursts and replace-on-save (unlink + add) are debounced into one clean update.

### Authorship & presence

- Per-line diff **attribution** — a gutter author icon and tooltip mark externally-changed lines.
- An **"…is editing" presence** badge driven by write bursts; the author label is configurable
  (`--author` / `WATCHDOWN_AUTHOR`).

### Cooperative AI-tool integrations

- A **Connection Manager** (Tools → Manage integrations) to opt in to _exact_ attribution for
  **Claude Code**, **Cursor**, and **Gemini CLI** — each announces its edits via a hook, so
  authorship is never guessed. New tools slot into a registry.

### Editor

- Split-pane **live rendered preview**, scroll-synced with the source.
- A **File / Edit / View / Tools** application menu, and a **light / dark / system** appearance
  setting.

### Packaging

- **Windows / macOS / Linux** installers with a custom app icon, released via release-please + CI.
