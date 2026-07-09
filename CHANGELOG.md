# Changelog

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
