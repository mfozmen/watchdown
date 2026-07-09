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

## Stack

TypeScript in strict mode, built with:

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) — desktop shell and build tooling
- [CodeMirror 6](https://codemirror.net/) — the editor surface
- [chokidar](https://github.com/paulmillr/chokidar) — cross‑platform file watching
- [node-diff3](https://github.com/bhousel/node-diff3) — the diff3 algorithm behind the 3‑way merge
- [Vitest](https://vitest.dev/) — the test runner for the pure core
- [electron-builder](https://www.electron.build/) — packaging

## Architecture principle

All non‑trivial logic lives in a **pure, UI‑independent core** (`src/core/`) with zero Electron,
DOM, or filesystem dependencies, so it is fast and deterministic to unit‑test. Electron,
CodeMirror, and chokidar are **thin adapters**. If you find yourself writing real logic in an
adapter, extract it into a pure, tested helper in `src/core/` instead.

```
src/
  core/      # pure sync engine + helpers (no Electron/DOM/fs) — unit-tested
  shared/    # IPC type contract shared by main and renderer
  main/      # Electron main: open/read/save + chokidar file watching
  preload/   # contextBridge API surface (no raw fs/ipc in the renderer)
  renderer/  # CodeMirror editor, preview, status bar, conflict resolver
```

## Workflow

- **Test‑first for the pure core.** Write one small failing test, watch it fail for the right
  reason, then write the minimal code to pass — red → green → refactor. The Electron/CodeMirror
  glue is exempt and verified by `typecheck` plus a manual run.
- **Branch per change** off the latest `main`; never commit to `main` directly. Prefix branches
  with a Conventional Commit type: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`,
  `perf/`, `build/`, `ci/`, or `style/`.
- **[Conventional Commits](https://www.conventionalcommits.org):** `type(scope): imperative,
  lowercase description`.

## Commands

```bash
npm test              # run the pure-core test suite once
npm run test:watch    # watch mode
npm run test:coverage # tests with coverage (feeds SonarQube Cloud)
npm run typecheck     # type-check the core, main/preload, and renderer projects
npm run build:app     # production bundle via electron-vite
npm run dist          # packaged Windows installer via electron-builder (see the README
                      # Roadmap for the signing / icon / other-platform / CI-release follow-ups)
```

Before opening a PR, make sure `npm test`, `npm run typecheck`, and `npm run build:app` pass. On
your PR, CI (type‑check + tests) and an automated code review run and must pass before merge;
SonarQube Cloud additionally reports coverage and a quality gate on new code (aim for ≥80%
coverage on new code).

## Local code signing (optional, Windows)

Packaged builds are unsigned by default (CI releases too). To exercise the Windows signing
pipeline locally with a **self-signed** certificate:

```powershell
npm run cert:win     # writes certs/watchdown-selfsigned.pfx (gitignored) and prints two env-var lines
# paste the $env:CSC_LINK and $env:CSC_KEY_PASSWORD lines it printed (the password is random), then:
npm run dist         # electron-builder signs when CSC_LINK is set
```

> [!NOTE]
> A self-signed signature does **not** remove SmartScreen / "unknown publisher" warnings for other
> users — it only proves the binary is signed. To clear the warning on your own machine, import the
> `.pfx` into your Trusted Root and Trusted Publishers stores — but note this makes your machine
> trust **anything** signed by that certificate, so only do it for a cert you control. For real
> distribution signing, see the Roadmap (SignPath — free for open source — or a CA certificate;
> macOS needs an Apple Developer membership).

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please) — don't
bump the version or tag by hand. Every merge to `main` updates an open **release PR**
(`chore(main): release X.Y.Z`) that bumps `package.json` and `CHANGELOG.md` from the Conventional
Commits (`feat:` → minor, `fix:` → patch, `BREAKING CHANGE`/`!` → major). **Merging that PR cuts
the release**: it creates the `vX.Y.Z` tag + GitHub Release, and CI then builds the
Windows/macOS/Linux installers and attaches them.

## More

The full conventions — including the autonomous review‑to‑green loop and the thin‑adapter
carve‑out — live in [CLAUDE.md](CLAUDE.md).
