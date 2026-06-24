# Review learnings

A running log of concrete lessons from PR code reviews, **newest first**. Terse by design —
signal, not a changelog. Recurring, project-wide conventions belong in CLAUDE.md instead;
this file is for one-off or context-specific notes. See the "Recording review learnings"
rule in CLAUDE.md.

- 2026-06-23 — Conflict + local edit: while in conflict, `applyLocalEdit` drifts `content` from the frozen `conflict.ours`; the 3-way merge resolver should treat the live buffer as canonical "ours". From PR #8 review.
- 2026-06-23 — Conflict + repeat external write: a second `applyExternalChange` during conflict rebuilds `base` from the pre-conflict disk, not the prior `theirs`; the resolver must define how `base` advances. From PR #8 review.
- 2026-06-23 — Sync-engine state: keep `isClean`/`isDirty` independently derived (not `isDirty = !isClean`) so the upcoming conflict state can be mutually exclusive. From PR #5 review.
