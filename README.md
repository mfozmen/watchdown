# Watchdown

<!-- SonarQube Cloud badges. If your Sonar projectKey differs from
     `mfozmen_watchdown`, update it in every badge URL AND the dashboard links below. -->
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=coverage)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=mfozmen_watchdown&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=mfozmen_watchdown)

A cross-platform desktop markdown editor whose defining feature is **live external-edit sync**: when the open `.md` file is modified on disk by another program — especially AI coding tools like Claude Code — Watchdown reflects those changes instantly. It is built to be a first-class companion to AI tools that edit files directly.

## Status

**MVP editor (Phase A).** A working desktop markdown editor with **live external sync**:
open a `.md` file, edit it, and when another program changes the file on disk Watchdown
reflects it instantly — silently reloading while preserving your cursor and scroll when
you have no unsaved edits, and 3-way-merging (never overwriting your work) when you do.

Authorship attribution, the "Claude is editing…" presence indicator, and interactive
conflict resolution are the next phases.

## Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) — desktop shell & build
- TypeScript (strict mode)
- [CodeMirror 6](https://codemirror.net/) — editor surface
- [chokidar](https://github.com/paulmillr/chokidar) — file watching
- [node-diff3](https://github.com/bhousel/node-diff3) — 3-way merge
- [Vitest](https://vitest.dev/) — testing

## Architecture

The core sync engine is pure TypeScript with **zero** Electron, DOM, or filesystem
dependencies, so it can be unit-tested instantly and deterministically. Electron,
CodeMirror, and chokidar are a thin adapter on top; any non-trivial logic is pushed
down into pure, tested helpers in `src/core/`.

```
src/
  core/      # pure sync engine + helpers (no Electron/DOM/fs) — unit-tested
  shared/    # IPC type contract
  main/      # Electron main: open/read/save + chokidar watch (thin adapter)
  preload/   # contextBridge API (no raw fs/ipc in the renderer)
  renderer/  # CodeMirror editor + status bar (thin adapter)
```

## Run it (dev)

```bash
npm install
npm run dev               # opens a native file picker
npm run dev -- notes.md   # or open a specific .md file
```

Edit in the window; **Ctrl/Cmd+S** saves. Change the file in another editor (or have an AI
tool rewrite it) and watch Watchdown live-update. The status bar shows
**Saved / Unsaved changes / Conflict**.

## Development

```bash
npm test          # run the pure-core test suite once
npm run test:watch
npm run typecheck # core + main/preload + renderer
npm run build:app # production bundle (electron-vite)
```

## License

MIT © mfozmen
