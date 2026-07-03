// CodeMirror glue that renders attribution data (from src/core/attribution.ts) as gutter
// author icons, changed-line decorations, a one-shot highlight, and accessible tooltips.
// Thin adapter: no attribution logic here — it consumes the pure core result.
//
// Scope: shows the MOST RECENT external change's attribution (replaced on each change).
// Accumulating authorship across many changes (with line-shift composition) is deferred —
// it adds little while every external write shares one 'external' author.

import { Decoration, EditorView, GutterMarker, gutter, type DecorationSet } from '@codemirror/view';
import {
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import type { AttributedRange } from '../../core/attribution.js';
import { formatRelativeTime } from '../../core/relative-time.js';
import { clampToLineNumber } from '../../core/line-index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build the author glyph (a pencil) via safe DOM — vector, themeable via currentColor, no emoji. */
function authorIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M11.6 1.6a1.4 1.4 0 0 1 2 2L5.9 11.3l-2.7.7.7-2.7z');
  svg.appendChild(path);
  return svg;
}

interface AttributionData {
  readonly ranges: readonly AttributedRange[];
  readonly label: string;
  readonly at: number;
}

const setAttribution = StateEffect.define<AttributionData>();

function tooltipFor(range: AttributedRange, label: string, at: number): string {
  const when = formatRelativeTime(at, Date.now());
  if (range.kind === 'removed') {
    const n = range.removedCount;
    return `${n} line${n === 1 ? '' : 's'} removed by ${label} · ${when}`;
  }
  return `Changed by ${label} · ${when}`;
}

class AuthorMarker extends GutterMarker {
  // `describe` is a closure so the relative time is recomputed each time it's shown,
  // rather than frozen at build time (which would go stale before the user hovers).
  constructor(private readonly describe: () => string) {
    super();
  }
  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-attr-icon';
    el.tabIndex = 0; // keyboard-reachable, not hover-only
    el.setAttribute('role', 'img');
    const refresh = (): void => {
      const text = this.describe();
      el.setAttribute('aria-label', text); // announced to screen readers on focus
      el.dataset['tooltip'] = text; // CSS tooltip shows on hover AND keyboard focus
    };
    refresh();
    el.addEventListener('mouseenter', refresh);
    el.addEventListener('focus', refresh);
    el.appendChild(authorIcon());
    return el;
  }
}

class SpacerMarker extends GutterMarker {
  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-attr-icon';
    return el; // empty: reserves gutter width so markers appearing cause no layout shift
  }
}

const changedLine = Decoration.line({ class: 'cm-attr-changed' });

function lineStart(state: EditorState, lineIndex: number): number {
  return state.doc.line(clampToLineNumber(lineIndex, state.doc.lines)).from;
}

function buildLineDecorations(state: EditorState, data: AttributionData): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of data.ranges) {
    if (range.kind === 'removed') continue; // a pure deletion has no line to highlight
    for (let line = range.start; line < range.end; line++) {
      const pos = lineStart(state, line);
      builder.add(pos, pos, changedLine);
    }
  }
  return builder.finish();
}

function buildGutterMarkers(state: EditorState, data: AttributionData): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  for (const range of data.ranges) {
    const pos = lineStart(state, range.start); // one icon per region, on its first line
    builder.add(pos, pos, new AuthorMarker(() => tooltipFor(range, data.label, data.at)));
  }
  return builder.finish();
}

const lineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setAttribution)) deco = buildLineDecorations(tr.state, effect.value);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const gutterField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setAttribution)) markers = buildGutterMarkers(tr.state, effect.value);
    }
    return markers;
  },
});

const attributionGutter = gutter({
  class: 'cm-attr-gutter',
  markers: (view) => view.state.field(gutterField),
  initialSpacer: () => new SpacerMarker(),
});

/** CodeMirror extension that renders attribution decorations. */
export function attributionExtension(): Extension {
  return [lineField, gutterField, attributionGutter];
}

/** Render the given attribution ranges (from the latest external change) in the editor. */
export function applyAttribution(
  view: EditorView,
  ranges: readonly AttributedRange[],
  label: string,
  at: number,
): void {
  view.dispatch({ effects: setAttribution.of({ ranges, label, at }) });
}
