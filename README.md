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

> [!NOTE]
> **Status: early, in active development.** The Phase A MVP editor works end‑to‑end (open,
> edit, save, and live external sync). The authorship‑ and presence‑visualization phases are
> not built yet — see [Roadmap](#roadmap). Expect rough edges; not yet recommended for
> irreplaceable files.

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

- **Live external sync.** Edits made to the open file by any other program appear immediately.
- **Keeps your place.** When you have no unsaved changes, external edits reload silently while
  preserving your cursor position and scroll offset.
- **Never loses your work.** When you *do* have unsaved edits, an external change is reconciled
  with a git‑style **3‑way merge** instead of overwriting your buffer.
- **Both sides preserved on conflict.** If edits genuinely overlap, Watchdown keeps your
  version *and* the incoming one and surfaces a non‑destructive conflict state — saving is
  blocked while conflicted so neither side is silently dropped.
- **Handles atomic saves.** Rapid write bursts and atomic replace‑on‑save (unlink + add) are
  debounced, so you get one clean update, not a flicker.
- **CodeMirror 6 editor** with Markdown syntax, a clean status bar (Saved / Unsaved changes /
  Conflict), dark‑mode support, and keyboard‑first interaction.
- **Secure by default.** The Electron shell runs with `contextIsolation`, a sandboxed preload,
  and no `nodeIntegration`; the renderer never touches the filesystem directly.

## Demo

> [!NOTE]
> A screen recording of live sync in action will be added as the UI stabilizes. In the
> meantime, the quickest way to see it is to run it (below) and edit the open file from another
> program.

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

## Development

Watchdown is TypeScript in strict mode, built with:

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) — desktop shell and build tooling
- [CodeMirror 6](https://codemirror.net/) — the editor surface
- [chokidar](https://github.com/paulmillr/chokidar) — cross‑platform file watching
- [node-diff3](https://github.com/bhousel/node-diff3) — the underlying diff3 algorithm
- [Vitest](https://vitest.dev/) — the test runner for the pure core

Common commands (all defined in `package.json`):

```bash
npm test              # run the pure-core test suite once
npm run test:watch    # watch mode
npm run test:coverage # tests with coverage (feeds SonarQube Cloud)
npm run typecheck     # type-check the core, main/preload, and renderer projects
npm run build:app     # production bundle via electron-vite
npm run pack          # unpacked app in release/ (fast, for a smoke test)
npm run dist          # distributable installer via electron-builder
```

`npm run dist` produces a Windows installer under `release/`. The build is currently
**unsigned** and uses the default Electron icon — code signing (needs a certificate), a
custom icon, other platforms (macOS/Linux), and a tagged CI release are follow-ups.

You can also label external edits explicitly, since the author can't be detected from a
disk write: launch with `--author "Claude"` (or set `WATCHDOWN_AUTHOR`) so presence and
attribution read "Claude is editing…" / "Changed by Claude".

The project follows strict test‑first development for the pure core; the Electron/CodeMirror
glue is a deliberately thin, typecheck‑verified adapter. See [CLAUDE.md](CLAUDE.md) for the
full contributor conventions.

### Project layout

```
src/
  core/      # pure sync engine + helpers (no Electron/DOM/fs) — unit-tested
  shared/    # IPC type contract shared by main and renderer
  main/      # Electron main: open/read/save + chokidar file watching
  preload/   # contextBridge API surface (no raw fs/ipc in the renderer)
  renderer/  # CodeMirror editor + status bar
```

## Roadmap

**Shipped**

- **Phase A — MVP editor + live external sync:** open/edit/save, silent clean reloads with
  cursor/scroll preserved, dirty‑state 3‑way merge, and a non‑destructive conflict state.
- **Phase B/C — authorship & presence:** per‑line diff attribution (gutter author icon +
  tooltip) and a "…is editing" presence indicator driven by write bursts.
- **Editor features:** split‑pane live rendered preview (scroll‑synced to the editor), a real
  File/Edit/View menu (Open / Save / Save As), an interactive per‑hunk conflict resolver
  (keep mine / theirs / both), a configurable external‑author label
  (`--author "Claude"` / `WATCHDOWN_AUTHOR`), and a packaged Windows build.

**Follow‑ups / backlog**

- **Packaging:** code signing (needs a certificate), a custom app icon, macOS/Linux targets,
  and a tagged CI release workflow (`npm run dist` isn't wired into CI yet).
- **Bidirectional scroll‑sync** (preview → editor) with a programmatic‑scroll guard.
- **Concurrent‑write guard during conflict resolution** — a second external write mid‑resolution
  currently restarts per‑region progress (resolved text is kept).
- **Tool‑aware author heuristics** beyond the explicit `--author` label.

## License

MIT — see [LICENSE](LICENSE).
