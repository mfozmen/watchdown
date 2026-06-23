# Watchdown

A cross-platform desktop markdown editor whose defining feature is **live external-edit sync**: when the open `.md` file is modified on disk by another program — especially AI coding tools like Claude Code — Watchdown reflects those changes instantly. It is built to be a first-class companion to AI tools that edit files directly.

## Status

Early development. The pure TypeScript **sync engine** (the heart of the app) is being built first, test-driven. Electron, CodeMirror, and chokidar adapters come later.

## Tech stack

- [Electron](https://www.electronjs.org/) — desktop shell (later)
- TypeScript (strict mode)
- [CodeMirror 6](https://codemirror.net/) — editor surface (later)
- [chokidar](https://github.com/paulmillr/chokidar) — file watching (later)
- [Vitest](https://vitest.dev/) — testing

## Architecture

The core sync engine is pure TypeScript with **zero** Electron, DOM, or filesystem dependencies, so it can be unit-tested instantly and deterministically. Everything else is a thin adapter on top.

```
src/
  core/      # pure sync engine (no Electron/DOM/fs)
  main/      # Electron main process (later)
  renderer/  # Electron renderer + CodeMirror (later)
```

## Development

```bash
npm install
npm test          # run the test suite once
npm run test:watch
npm run typecheck
```

## License

MIT © mfozmen
