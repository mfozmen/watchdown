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

![Watchdown in dark mode: an external tool's edits appear live in the editor with per-line
attribution and an "…is editing" presence badge beside the rendered preview, plus an inline
conflict resolver for overlapping edits](docs/watchdown-demo.gif)

*As an external tool (labelled `Claude`, via `--author`) writes the file, its lines appear live —
with per‑line attribution and an "…is editing" presence badge — beside the rendered preview. When
your unsaved edits overlap an external change, the interactive conflict resolver (keep mine /
theirs / both) appears inline.*

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
- **Exact AI-tool attribution** — connect a tool from the **Connection Manager** (Tools → Manage
  integrations) and Watchdown adds a hook so its edits are attributed *precisely* (e.g. "Claude
  Code"), not guessed; disconnect any time. Other tools use the configurable label above.

**A real editor:**

- **Split‑pane live preview**, scroll‑synced with the source (CodeMirror 6 + a sanitized Markdown
  renderer).
- **Interactive conflict resolver** with per‑hunk *keep mine / theirs / both* buttons.
- **Application menu** — Open / Save / Save As plus standard Edit/View, and a title bar that
  shows the file and unsaved state.
- **Light / dark / system appearance** — follows the OS by default, with a manual override in
  **View → Appearance** that's remembered across launches.
- **Packaged Windows/macOS/Linux builds** via electron‑builder, with a custom app icon
  (`npm run dist`).

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
- **Cooperative AI-tool integrations:** a **Connection Manager** (Tools → Manage integrations)
  where you opt in to add a tool's edit hook so its edits are attributed exactly — a cooperative
  signal, not a guess. **Claude Code**, **Cursor**, and **Gemini CLI** ship first, behind a
  registry that new tools slot into.
- **Editor features:** split‑pane live rendered preview (scroll‑synced both ways), a real
  File/Edit/View menu (Open / Save / Save As), a light/dark/system appearance setting, an
  interactive per‑hunk conflict resolver (keep mine / theirs / both), a configurable
  external‑author label
  (`--author "Claude"` / `WATCHDOWN_AUTHOR`), and packaged Windows/macOS/Linux builds — with a
  custom app icon — via a tagged CI release.

**Follow‑ups / backlog** (deferred)

- **Code signing** — the builds are currently unsigned; it needs a code‑signing certificate
  (Windows) and an Apple Developer membership (macOS), so it's deferred until those are in hand.
- **Copilot CLI integration** — deferred: its `postToolUse` hook works and reads stdin, but the
  edited‑file field in the tool payload isn't documented in any official source, so it needs
  confirming against a real payload before we can attribute reliably (guessing would silently
  no‑op).
- **More AI‑tool integrations** — any tool with a file‑edit hook can be added as a registry entry;
  plus a best‑effort fallback for tools with no edit hook (e.g. Aider, Codex).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the test‑first
workflow, and the branching and commit conventions.

## License

MIT — see [LICENSE](LICENSE).
