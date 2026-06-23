# Review learnings

A running log of concrete lessons from PR code reviews, **newest first**. Terse by design —
signal, not a changelog. Recurring, project-wide conventions belong in CLAUDE.md instead;
this file is for one-off or context-specific notes. See the "Recording review learnings"
rule in CLAUDE.md.

- 2026-06-23 — Sync-engine state: keep `isClean`/`isDirty` independently derived (not `isDirty = !isClean`) so the upcoming conflict state can be mutually exclusive. From PR #5 review.
