# Watchdown

<!-- Badges. If your Sonar projectKey differs from `mfozmen_watchdown`, update it in every
     Sonar badge URL AND the dashboard links below. -->
[![CI](https://github.com/mfozmen/watchdown/actions/workflows/ci.yml/badge.svg)](https://github.com/mfozmen/watchdown/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=coverage)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)

**A cross-platform desktop Markdown editor whose defining feature is live external‑edit sync.**

When another program changes the `.md` file you have open — a second editor, a script, or an
AI coding tool like Claude Code — Watchdown reflects the change **instantly**, without you
reloading and without clobbering your unsaved work. It's built to be a first‑class companion
to tools that edit files directly on disk.

![Watchdown live external-edit sync: an external tool labelled "Claude" writes the open file and
its new lines appear instantly in the editor — attributed, with an "…is editing" presence badge —
beside the live rendered preview](docs/watchdown-demo.gif)

*As an external tool (here labelled `Claude`, via `--author`) writes the file, its lines appear
live with per‑line attribution and an "…is editing" presence badge while the split‑pane preview
re‑renders. Menus and the interactive conflict resolver are best seen by running it.*

## Why Watchdown

AI coding tools and formatters increasingly rewrite files **on disk** while you're looking at
them. Most editors respond by either silently reloading (losing your place, or your unsaved
edits) or nagging you with a "file changed on disk" prompt. Watchdown treats an external write
as a first‑class event: it merges it in when it safely can, and preserves both sides when it
can't — so you never lose work and never fight your tools.

External tools don't emit keystrokes or cursors; they just write the finished file. So
Watchdown reconstructs what changed by **diffing the previous content against the new content**
— an approach that is tool‑agnostic by design (it works the same for Claude Code, `vim`, VS
Code, or `sed`).

## Features

**Live external‑edit sync — the defining feature:**

- **Instant reflection.** Edits to the open file by any other program appear immediately.
- **Keeps your place.** With no unsaved changes, external edits reload silently, preserving your
  cursor and scroll.
- **Never loses your work.** With unsaved edits, an external change is reconciled by a git‑style
  **3‑way merge** — disjoint changes auto‑merge; genuine overlaps become a non‑destructive
  conflict, with saving blocked until you resolve so neither side is dropped.
- **Handles atomic saves.** Rapid write bursts and replace‑on‑save (unlink + add) are debounced
  into one clean update.

**See who changed what:**

- **Per‑line attribution** — a gutter author icon and tooltip mark externally‑changed lines.
- **Presence** — an "…is editing" badge driven by write bursts; the author label is configurable
  (`--author "Claude"`), so it can read "Claude is editing…".

**A real editor:**

- **Split‑pane live preview**, scroll‑synced with the source (CodeMirror 6 + a sanitized Markdown
  renderer).
- **Interactive conflict resolver** with per‑hunk *keep mine / theirs / both* buttons.
- **Application menu** — Open / Save / Save As plus standard Edit/View, and a title bar that
  shows the file and unsaved state.
- **Packaged Windows build** via electron‑builder (`npm run dist`).

**Secure by default** — `contextIsolation`, a sandboxed preload, no `nodeIntegration`, and a
strict CSP; the renderer never touches the filesystem directly.

## How it works

The heart of Watchdown is a **UI‑independent sync engine** written as pure TypeScript with zero
Electron, DOM, or filesystem dependencies. It owns the clean / dirty / conflict state machine,
the 3‑way merge, and the debounce logic — all unit‑tested and deterministic. Electron,
CodeMirror, and chokidar are thin adapters layered on top; any non‑trivial logic lives in the
pure core rather than the glue.

## Getting started

> [!IMPORTANT]
> Requires [Node.js](https://nodejs.org/) 22+ (the version CI builds against).

```bash
git clone https://github.com/mfozmen/watchdown.git
cd watchdown
npm install
npm run dev                 # launches the app with a native file picker
npm run dev -- notes.md     # or open a specific Markdown file directly
```

Edit in the window and press **Ctrl/Cmd+S** to save. Now change the same file from another
editor — or have an AI tool rewrite it — and watch Watchdown update live. The status bar
reflects whether the buffer is **Saved**, has **Unsaved changes**, or is in **Conflict**.

## Roadmap

**Shipped**

- **Phase A — MVP editor + live external sync:** open/edit/save, silent clean reloads with
  cursor/scroll preserved, dirty‑state 3‑way merge, and a non‑destructive conflict state.
- **Phase B/C — authorship & presence:** per‑line diff attribution (gutter author icon +
  tooltip) and a "…is editing" presence indicator driven by write bursts.
- **Editor features:** split‑pane live rendered preview (scroll‑synced both ways), a real
  File/Edit/View menu (Open / Save / Save As), an interactive per‑hunk conflict resolver
  (keep mine / theirs / both), a configurable external‑author label
  (`--author "Claude"` / `WATCHDOWN_AUTHOR`), and a packaged Windows build.

**Follow‑ups / backlog**

- **Packaging:** code signing (needs a certificate), a custom app icon, macOS/Linux targets,
  and a tagged CI release workflow (`npm run dist` isn't wired into CI yet).
- **Tool‑aware author heuristics** beyond the explicit `--author` label.
- **Docs consistency:** the autonomous‑review‑loop text (CLAUDE.md / AGENTS.md / `.claude-pr`)
  still says to iterate until "CI, Sonar, and claude‑review are all green," but Sonar runs
  advisory and doesn't gate merge — reconcile the wording.
- **Richer demo GIF** — a dark‑theme capture that also shows the interactive conflict resolver.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the test‑first
workflow, and the branching and commit conventions.

## License

MIT — see [LICENSE](LICENSE).
