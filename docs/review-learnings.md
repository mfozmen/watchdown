# Review learnings

A running log of concrete lessons from PR code reviews, **newest first**. Terse by design —
signal, not a changelog. Recurring, project-wide conventions belong in CLAUDE.md instead;
this file is for one-off or context-specific notes. See the "Recording review learnings"
rule in CLAUDE.md.

- 2026-07-05 — Preview vs conflict markers (for the resolver PR): the markdown preview re-renders on every `docChanged` from the raw buffer. Today conflict leaves the buffer as the user's version (no markers injected), so nothing leaks. But once the interactive resolver injects inline `<<<<<<<`/`=======`/`>>>>>>>` into the buffer, the preview will render them as literal escaped text — make the preview conflict-aware (skip/segment those regions) in that PR. From PR #20 review.
- 2026-07-04 — Presence linger vs burst settle: `PRESENCE_LINGER_MS` (renderer) is intentionally **not** derived from the main process's `QUIET_MS`. The linger is a UX display duration (how long "…is editing" persists after activity stops); `QUIET_MS` is a filesystem burst-settle window. They're conceptually independent — the linger just needs to sit comfortably above it. Deriving one from the other would misrepresent a soft floor as a hard dependency, so keep them decoupled. From PR #19 review.
- 2026-07-04 — aria-live re-announcement: writing identical text to a live region (`role="status"`/`aria-live`) can make screen readers re-announce it. Guard status-region DOM updates to fire only when the rendered text actually changes, so a repeated state (e.g. "…is editing" across a write burst) is announced once. From PR #19.
- 2026-07-03 — Dynamic tooltip values: compute relative time ("· 2s ago") at display time (on hover/focus), not baked into the marker at build time, or it goes stale before the user looks. Applies to any relative/live display value in the UI. From PR #18 review.
- 2026-07-03 — Review turn budget: don't set claude-review `--max-turns` too low. 30 was non-convergent (a small PR needed 31 and failed the required check); set to 50. The cap only bounds the worst case — it adds no cost when a run converges early — so generous headroom is nearly free and avoids spurious merge-blocks. From PR #13.
- 2026-07-02 — CSP `style-src 'unsafe-inline'`: needed because CodeMirror injects its theme as an inline `<style>`; delivered via a main-process response header (not the HTML meta). Tighten to a nonce-based CSP when CodeMirror gains clean nonce support. From PR #12 review.
- 2026-06-23 — Conflict + local edit: while in conflict, `applyLocalEdit` drifts `content` from the frozen `conflict.ours`; the 3-way merge resolver should treat the live buffer as canonical "ours". From PR #8 review.
- 2026-06-23 — Conflict + repeat external write: a second `applyExternalChange` during conflict rebuilds `base` from the pre-conflict disk, not the prior `theirs`; the resolver must define how `base` advances. From PR #8 review.
- 2026-06-23 — Sync-engine state: keep `isClean`/`isDirty` independently derived (not `isDirty = !isClean`) so the upcoming conflict state can be mutually exclusive. From PR #5 review.
