---
name: ui-ux
description: >
  Desktop UI/UX guidance for Watchdown's editor surface (Electron + CodeMirror):
  accessibility and keyboard support, contrast and dark mode, editor typography,
  animation and reduced-motion, color semantics for diff/authorship/conflict, and
  status/feedback. Plus project-specific guidance for the live presence and
  diff-attribution UI. Use when designing, building, or reviewing any editor UI —
  gutters, markers, author glyphs, highlights, the status bar, or conflict rendering.
---

# UI/UX — Watchdown editor

Curated, desktop-focused UX reference for the Watchdown markdown editor. Distilled
for an **Electron + CodeMirror desktop app** — not mobile. The defining UI is the
**editor surface plus the live presence / diff-attribution layer** (gutter markers,
author icons, change highlights, status bar, inline conflict rendering).

## When to use

- Designing or building the editor UI, gutter, status bar, or any control.
- Implementing the presence / diff-attribution layer (changed-line markers, author
  glyphs, highlight-on-external-change, "Codex is editing…" status).
- Rendering the conflict state (inline markers, accept/keep affordances).
- Reviewing UI for accessibility, contrast, keyboard support, or visual consistency.

## Skip

- Pure core / sync-engine logic (it has no UI — keep it that way).
- Backend, filesystem, or build/CI work.

This is desktop. Ignore mobile-only concerns (touch-target sizes, safe areas/notch,
haptics, bottom nav, swipe gestures) unless a real touch surface is added later.

## 1. Accessibility & keyboard (CRITICAL)

- Keyboard-first: every action reachable without a mouse; Tab order matches visual order.
- Preserve visible focus rings (2–4px) on all interactive controls — never remove them.
- Respect editor/OS keyboard shortcuts; don't shadow standard ones.
- `aria-label` (or equivalent) on icon-only controls, including the author/presence glyph.
- Don't convey meaning by color alone — pair diff/authorship/conflict color with an
  icon, marker, or text so it survives color-blindness and high-contrast modes.
- Provide a text/tooltip equivalent for every gutter marker and author icon
  (e.g. "Changed by Codex · 2s ago").
- Announce live changes politely (`aria-live="polite"`) so external edits and status
  changes reach screen readers without stealing focus.

## 2. Contrast & dark mode (CRITICAL)

- Body/editor text ≥ 4.5:1; secondary text ≥ 3:1. Diff and marker colors ≥ 3:1 vs background.
- Design light and dark together; dark mode uses desaturated tonal variants, not
  inverted colors. Verify contrast per theme — don't assume light values carry over.
- Keep dividers, gutter markers, and interaction states visible in **both** themes.
- Drive all colors from semantic tokens (e.g. `--diff-added`, `--author-external`,
  `--conflict`), never raw hex in components.

## 3. Editor typography

- Monospace for the editor buffer; consistent line-height (~1.5) for readability.
- Use `font-display: swap/optional` and reserve space to avoid layout shift on load.
- Tabular figures for any aligned numeric UI (line numbers, timers).
- Don't truncate where wrapping is possible; if truncating, offer the full text on hover.

## 4. Animation & reduced-motion (MEDIUM)

- Micro-interactions 150–300ms; the brief highlight on an externally-changed region
  lands in this range — long enough to notice, short enough not to nag.
- Animate `transform`/`opacity` only; never `width`/`height`/`top`/`left` (causes reflow/CLS).
- Honor `prefers-reduced-motion`: replace highlight fades/pulses with an instant,
  static marker. Motion must be optional, never required to perceive a change.
- Animation should express cause→effect (a change appeared here), not decorate.
- Keep input/typing latency under ~100ms; never block typing during an animation.

## 5. Color semantics for diff / authorship / conflict

- Distinct, tokenized, accessible roles: added vs removed vs externally-changed vs
  conflicting. Each role = color **and** a non-color cue (gutter glyph, underline, icon).
- Author attribution needs a stable per-author color + a labeled icon; the external
  (e.g. Codex) author glyph is an SVG icon, **not an emoji** (emoji render
  inconsistently and can't be themed via tokens).
- Conflict regions must be unmistakable and legible in both themes; pair the color
  with clear inline structure, not just a background tint.

## 6. Feedback & status

- The status bar is the primary feedback channel: reflect clean / dirty / conflict and
  presence ("Codex is editing…" vs "Codex idle") promptly and unambiguously.
- Show progress for anything over ~300ms; prefer a calm indicator over a blocking spinner.
- Destructive or lossy actions (discarding unsaved edits, overwriting on conflict)
  require confirmation and, where possible, undo.
- Empty/idle states should explain, not show a blank surface.

## 7. Layout & polish

- One consistent icon set (stroke width, corner radius); SVG/vector only — no raster, no emoji.
- Consistent spacing rhythm (4/8px scale) and a defined z-index scale
  (editor < gutter overlays < tooltips < modals).
- Press/hover/active/disabled states visually distinct without shifting layout bounds.
- One primary action per surface; secondary actions visually subordinate.

## Pre-delivery checklist (desktop)

- [ ] Fully keyboard operable; focus order logical; focus rings visible.
- [ ] Text ≥ 4.5:1, markers/diff ≥ 3:1 — verified in light **and** dark.
- [ ] No color-only meaning — every diff/author/conflict cue has a non-color signal.
- [ ] `prefers-reduced-motion` respected (highlights degrade to static markers).
- [ ] Author/presence glyphs are SVG icons with accessible labels and tooltips.
- [ ] Status bar correctly reflects clean / dirty / conflict and presence.
- [ ] No layout shift from change highlights or state transitions (transform/opacity only).
- [ ] Colors come from semantic tokens, not inline hex.

---

Adapted (desktop-only subset) from
[ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) by
Next Level Builder, MIT License. The original is a mobile/React-Native design-system
tool with a Python search CLI and a large data corpus; this is a trimmed, static,
desktop-editor-focused reference with no scripts or bundled data.
