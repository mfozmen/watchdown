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
- **Thin-adapter carve-out:** the Electron main/preload and the CodeMirror renderer —
  genuinely untestable glue (window creation, DOM wiring, IPC plumbing) — are exempt from
  test-first and are verified by `typecheck` + manual run. This is not a loophole: any
  **non-trivial logic** must be extracted into a **pure, test-first helper in `src/core/`**
  (as with the write-burst, watch-event, and external-sync helpers), never tested through
  the adapter. The adapter is coverage-excluded so the metric stays meaningful.

## Branching workflow (HARD RULE — non-negotiable)

- **NEVER commit directly to `main`.** `main` is the protected, review-only integration
  branch.
- For every unit of work, create a new branch off the **latest `main`**. Naming prefixes (the
  Conventional Commit types): `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `perf/`,
  `build/`, `ci/`, `style/`.
- Work, commit, and **stop** on that branch. The human reviews it (code review / PR) and
  merges into `main`.
- **Do not merge into `main` yourself** unless explicitly told to.

## Autonomous review-to-green loop (HARD RULE)

This changes the **default** per-increment flow. After opening a PR, do **not** immediately
stop for human review — autonomously drive the PR to green, then stop at the merge boundary.

**Autonomous iteration (do this without waiting for the human):**

- Watch the PR's checks (e.g. `gh pr checks <n> --watch`) and read the claude-review findings
  (`gh pr view <n> --comments`, plus the inline review comments).
- Address findings and push fixes on the **same branch**, following all existing rules
  (test-first for pure logic, Conventional Commits, the thin-adapter carve-out). Re-run until
  **CI, Sonar, and claude-review are green**. CI and claude-review gate the merge; Sonar is
  advisory (a quality signal on new code, not a merge gate) — keep it green, but it won't block.
- Apply **judgment** — claude-review is advisory. Fix what is genuinely warranted; do **not**
  blindly action every suggestion just to silence the reviewer (e.g. we intentionally kept the
  `base`/`ours`/`theirs` naming against a rename suggestion). Record any generalizable lesson
  per the "Recording review learnings" rule.
- **Bound the loop:** at most ~3 fix iterations. If checks still aren't green, or a check
  stalls for a **non-code reason** (e.g. claude-review hitting turn limits, or a transient
  failure), **stop and report** to the human rather than thrashing or burning quota.

**Two human gates (never cross these autonomously):**

1. **Never merge to `main`.** When the PR is green and converged, **stop** and hand it to the
   human to merge. (The human may explicitly grant merge for a specific PR; only then may you
   merge it.)
2. **Escalate instead of self-resolving** when a finding involves: a **design/product
   decision**, a change to or conflict with **CLAUDE.md or project policy**, a **data-safety
   tradeoff**, or anything that would require **fabricating or guessing**. In those cases
   **stop and ask the human** — do not silently decide.

Everything else (branch-per-unit-of-work, no direct commits to `main`, Conventional Commits,
TDD discipline) is unchanged.

## Commit messages: Conventional Commits (HARD RULE — non-negotiable)

Every commit **MUST** follow the [Conventional Commits](https://www.conventionalcommits.org)
spec. This applies to **every commit from now on, no exceptions.**

- Format: `type(optional-scope): description`
- Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`,
  `ci`, `style`.
- Description is **imperative and lowercase** ("add", not "Added"/"Adds").
- Use a `BREAKING CHANGE:` footer (or `!` after the type/scope, e.g. `feat!:`) when the
  change is backward-incompatible.

## Code comments (style guideline)

Keep comments concise and explain the **why**, not the **what** — don't restate what the
code already says. Prefer a single short line; use a multi-line block only when the
rationale genuinely needs it. This is a guideline, not a hard rule: clarity wins over
brevity when a non-obvious decision needs explaining.

## Recording review learnings (HARD RULE)

After a PR's review feedback is addressed, record any **generalizable** lesson from that
review so the same feedback isn't repeated across sessions and contributors share one
memory. Route each lesson by kind:

- **Recurring, project-wide convention** (should shape *all* future work) → promote it into
  the relevant section of CLAUDE.md as a concise rule.
- **One-off or context-specific** observation → append a terse dated entry (newest first)
  to [`docs/review-learnings.md`](docs/review-learnings.md).
- Keep both terse — signal, not a changelog. Don't duplicate a lesson in both places.
- This normally rides along in the **same PR** that addresses the review feedback; only when
  feedback arrives on an **already-merged** PR does it get its own follow-up PR.

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

**Cooperative-authorship principle (never guess the tool):** a bare disk write carries no
author, so we **never infer WHICH tool wrote it from content** — a wrong "Claude edited this"
is worse than the neutral label. Exact tool identity comes only when the tool **cooperatively
announces** its edit: Claude Code does this via an opt-in PostToolUse hook (installed from the
Connection Manager, Tools → Manage integrations) that writes a signal Watchdown matches to the
disk change. Absent a signal, attribution falls back to the configurable `--author` /
`WATCHDOWN_AUTHOR` label. Any other tool that can run a hook can announce edits the same way —
each is a registry entry (a settings path + hook script + the pure per-tool settings-merge).

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

**Done** (all built test-first with the pure-core / thin-adapter split):

1. Base sync state machine (clean / dirty / conflict) with cursor/scroll preservation.
2. 3-way merge + authorship attribution (per-line diff, gutter author icons + tooltips).
3. Presence ("…is editing" from write bursts) + the diff-attribution UI layer.
4. Editor surface: split-pane live rendered preview (scroll-synced), File/Edit/View menu
   (Open / Save / Save As), light/dark/system appearance (nativeTheme + persisted preference),
   interactive per-hunk conflict resolver (keep mine/theirs/both), configurable external-author
   label, custom app icon, electron-builder Windows/macOS/Linux packaging, and release-please
   driving versioning + a GitHub Release with installers (see the release process below).
5. Cooperative AI-tool integrations: a Connection Manager (Tools → Manage integrations, an in-app
   modal) where the user opts in to install a tool's edit hook; matching disk changes are
   attributed exactly (see the cooperative-authorship principle above). Claude Code, Cursor, and
   Gemini CLI are the first entries in an adapter-side registry; pure core holds each tool's
   settings merge/unmerge plus the shared signal parse/attribution. Claude and Gemini share the
   nested matcher+hooks shape (core/nested-hook.ts); Cursor's is a flat afterFileEdit array.
   Verify a tool's hook format against its official docs before adding an entry — payloads differ
   (Claude/Gemini nest file_path under tool_input, Cursor is top-level; Gemini requires JSON-only
   stdout).

**Backlog / follow-ups (all deferred):**

- **Code signing** — builds are unsigned; needs a Windows code-signing certificate + an Apple
  Developer membership (macOS notarization). Deferred until those are available.
- **Copilot CLI integration** — its `postToolUse` hook exists and reads stdin, but the edited-file
  field inside the tool payload (`toolArgs`/`tool_input`) is **undocumented** across GitHub's hooks
  reference, the how-to, and copilot-sdk. Deferred: don't build on a guessed field name (it would
  silently no-op) — confirm against a real payload dump or updated docs first.
- **More AI-tool integrations** — add any tool with a file-edit hook as a registry entry (verify
  its format against official docs first); plus a best-effort fallback for tools with no hook
  (e.g. Aider, Codex).

## Release process (release-please)

Versioning and releases are automated with **release-please** — do **not** bump `version` in
`package.json` by hand or tag releases manually.

- Every merge to `main` runs `.github/workflows/release-please.yml`. From the merged Conventional
  Commits, release-please maintains an open **release PR** (`chore(main): release X.Y.Z`) that
  bumps `package.json` + updates `CHANGELOG.md`. `feat:` → minor, `fix:` → patch, `BREAKING
  CHANGE`/`!` → major — so commit hygiene *is* the version.
- **Cutting a release = merging that release PR** (the human gate). That creates the `vX.Y.Z` tag +
  GitHub Release; the same workflow's build job then packages the Windows/macOS/Linux installers
  and attaches them. No separate tag-triggered workflow (a GITHUB_TOKEN tag wouldn't trigger one).
- The first release is pinned to **1.0.0** via a one-time `Release-As: 1.0.0` commit footer; after
  that, versions follow the commits.

## Current state

- Full app built: Electron + electron-vite + CodeMirror 6 + chokidar installed and wired;
  electron-builder packaging in place. The pure core (`src/core/`) holds all non-trivial
  logic, unit-tested; `main`/`preload`/`renderer` are thin, typecheck-verified adapters.
- All roadmap phases above are shipped on `main`. New work continues under the same rules:
  test-first pure core, thin adapters, branch-per-PR, autonomous review-to-green loop.
