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

Follow the [architecture rules in CLAUDE.md](CLAUDE.md#architecture-principle-important).
The source is organized as follows:

```
src/
  core/      # pure sync engine + helpers (no Electron/DOM/fs) — unit-tested
  shared/    # IPC type contract shared by main and renderer
  main/      # Electron main: open/read/save + chokidar file watching
  preload/   # contextBridge API surface (no raw fs/ipc in the renderer)
  renderer/  # CodeMirror editor, preview, status bar, conflict resolver
```

## Workflow

Follow the [project workflow in CLAUDE.md](CLAUDE.md#workflow-strict-tdd-non-negotiable),
including test-first development, branch and commit conventions, and PR review gates.

## Commands

```bash
npm test              # run the pure-core test suite once
npm run test:watch    # watch mode
npm run test:coverage # tests with coverage (feeds SonarQube Cloud)
npm run typecheck     # type-check the core, main/preload, and renderer projects
npm run build:app     # production bundle via electron-vite
npm run dist          # package the app with electron-builder
```

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

Follow the [release-process skill](.claude/skills/release-process/SKILL.md) and the
[merge gate in CLAUDE.md](CLAUDE.md#autonomous-review-to-green-loop-hard-rule).
