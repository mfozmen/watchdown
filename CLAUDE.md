# Watchdown — Project Guide for AI Sessions

Read this fully before doing anything. It defines what we're building, the decided
stack, the architecture principle, and the non-negotiable workflow. Stay disciplined.

## Vision

Watchdown is a cross-platform **desktop markdown editor** whose defining feature is
**live external-edit sync**: when the currently open `.md` file is modified on disk by
an external program — especially AI coding tools like Claude Code — the editor reflects
those changes instantly. It is meant to be a first-class companion to AI tools that edit
files directly.

- Open source, MIT licensed.
- Author / owner: **mfozmen**.

## Tech stack (DECIDED — do not substitute)

- **Electron** — desktop shell.
- **TypeScript** in strict mode.
- **CodeMirror 6** — editor surface (added later).
- **chokidar** — file watching (added later).
- **Vitest** — testing.

Do not swap these out or introduce alternatives without explicit instruction.

## Architecture principle (important)

The heart of the app is a **UI-independent sync engine** written as **pure TypeScript
with zero Electron, DOM, or filesystem dependencies**, so it can be unit-tested instantly
and deterministically. Electron, CodeMirror, and chokidar are **thin adapters layered on
top later**. All non-trivial logic lives in the pure core.

```
src/
  core/      # pure sync engine — NO Electron, DOM, or fs imports
  main/      # Electron main process (reserved, later)
  renderer/  # Electron renderer + CodeMirror (reserved, later)
```

Tests live next to the source (`*.test.ts`) or under `tests/`.

## Workflow: strict TDD (non-negotiable)

- **Red → Green → Refactor**, one small failing test at a time.
- Write the **minimal** implementation needed to pass each test. No speculative features
  (YAGNI).
- Always watch the test fail for the right reason before writing implementation.
- Do **not** build the Electron UI or wire up chokidar until the core logic calls for it.
  Core logic comes first.

## Branching workflow (HARD RULE — non-negotiable)

- **NEVER commit directly to `main`.** `main` is the protected, review-only integration
  branch.
- For every unit of work, create a new branch off the **latest `main`**. Naming prefixes:
  `feat/...`, `fix/...`, `chore/...`, `test/...`.
- Work, commit, and **stop** on that branch. The human reviews it (code review / PR) and
  merges into `main`.
- **Do not merge into `main` yourself** unless explicitly told to.

## Commit messages: Conventional Commits (HARD RULE — non-negotiable)

Every commit **MUST** follow the [Conventional Commits](https://www.conventionalcommits.org)
spec. This applies to **every commit from now on, no exceptions.**

- Format: `type(optional-scope): description`
- Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`,
  `ci`, `style`.
- Description is **imperative and lowercase** ("add", not "Added"/"Adds").
- Use a `BREAKING CHANGE:` footer (or `!` after the type/scope, e.g. `feat!:`) when the
  change is backward-incompatible.

## Core requirements

### Live external-edit sync (defining feature)

When the open `.md` file changes on disk externally, the editor reflects it instantly.
The base sync state machine — **clean / dirty / conflict** — lives in the pure core.

### Live multi-author presence & merge (MUST-HAVE core requirement)

This is a **core requirement, not an optional nice-to-have.** When an external tool
(especially Claude Code, but any tool — vim, VS Code, `sed`, etc.) edits the open file on
disk **while the human is also editing in Watchdown**, the editor must show, in real time,
**both sets of changes and WHO changed WHAT**.

**Key technical reality (so future sessions don't design the wrong thing):**
External tools like Claude Code do **NOT** emit cursor positions or an operation stream —
they only write the **finished file to disk**. So unlike VS Code Live Share, we **cannot**
show a live remote cursor. Instead we **RECONSTRUCT presence and authorship from the only
signal we have — the disk change — by diffing previous content against new content.** This
diff-based approach is **tool-agnostic by design**.

**Desired behavior:**
- On an external change, **diff old vs new content** to find changed lines and attribute
  them to the external author.
- **Visual treatment:** changed-line markers in the gutter, a brief highlight on changed
  regions, and a small author icon (e.g. a Claude/robot glyph) next to externally-changed
  lines. Hovering the icon shows a tooltip like *"Changed by Claude · 2s ago"*.
- **Presence indicator:** detect **write bursts** (rapid successive external writes) to
  drive a status like *"Claude is editing…"* vs *"Claude idle"* in the status bar.
- **Concurrent edits in DIFFERENT regions** (human edits paragraph A, external tool edits
  paragraph C): **auto-merge**, keep both, show both.
- **Concurrent edits in the SAME region:** since we only have full snapshots (not an op
  stream), resolve with a **git-style 3-way merge** — base = last-known disk content,
  ours = the in-memory buffer, theirs = the new disk content — surfacing unresolvable
  overlaps as **inline conflict markers** in the editor.

**TDD note:** the UI (icons, highlights, presence badge) is a **thin layer**; the real
logic — **line diff, authorship attribution, 3-way merge** — is **PURE functions in the
core** and must be developed **test-first**.

## Roadmap / sequencing

1. **Base sync state machine** (clean / dirty / conflict) — *in progress now.*
2. The **"conflict" state evolves into 3-way merge + authorship attribution** (pure core).
3. **Presence + diff-attribution UI layer** as a dedicated later phase, built on top of
   the pure core.

## Current state

- Project scaffolding in place (package.json, strict tsconfig, Vitest).
- Only the pure-TypeScript test loop is installed. **Electron, CodeMirror, and chokidar
  are NOT installed yet** — add them only when the core work genuinely requires them.
- Building the sync engine's document state model (clean/dirty tracking, external-edit
  adoption) test-first.
