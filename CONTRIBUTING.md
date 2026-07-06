# Contributing to Watchdown

Thanks for your interest! Watchdown keeps a small, disciplined codebase — a few conventions keep
it that way.

## Getting set up

Requires [Node.js](https://nodejs.org/) 22+.

```bash
git clone https://github.com/mfozmen/watchdown.git
cd watchdown
npm install
npm run dev                 # or: npm run dev -- notes.md
```

## Architecture principle

All non‑trivial logic lives in a **pure, UI‑independent core** (`src/core/`) with zero Electron,
DOM, or filesystem dependencies, so it is fast and deterministic to unit‑test. Electron,
CodeMirror, and chokidar are **thin adapters** (`src/main`, `src/preload`, `src/renderer`). If
you find yourself writing real logic in an adapter, extract it into a pure, tested helper in
`src/core/` instead.

## Workflow

- **Test‑first for the pure core.** Write one small failing test, watch it fail for the right
  reason, then write the minimal code to pass — red → green → refactor. The Electron/CodeMirror
  glue is exempt and verified by `typecheck` plus a manual run.
- **Branch per change** off the latest `main`; never commit to `main` directly. Prefix branches
  `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `build/`, or `ci/`.
- **[Conventional Commits](https://www.conventionalcommits.org):** `type(scope): imperative,
  lowercase description`.

## Before you open a PR

```bash
npm test          # pure-core test suite
npm run typecheck # core + main/preload + renderer projects
npm run build:app # production bundle
```

CI, SonarQube Cloud (quality gate; ≥80% coverage on new code), and an automated review all run
on your PR and must pass before it is merged.

## More

The full conventions — including the autonomous review‑to‑green loop and the thin‑adapter
carve‑out — live in [CLAUDE.md](CLAUDE.md).
