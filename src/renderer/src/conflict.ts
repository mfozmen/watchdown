// CodeMirror glue for the interactive conflict resolver. On a conflict the buffer already
// shows OUR side; this overlays, above each conflicting region, a block widget with
// "Keep mine / Keep theirs / Keep both" buttons and highlights the region. Resolving a
// region rewrites just that span; when the last region is resolved, onAllResolved() fires.
//
// Thin adapter: the region layout and per-choice line result come from the pure core
// (conflict-resolution.ts); this only renders and dispatches the edits.

import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import {
  resolvedLines,
  type ConflictRegion,
  type ResolutionChoice,
} from '../../core/conflict-resolution.js';

interface ConflictItem {
  readonly id: number;
  /** Doc positions of the region (mapped through edits); from === to for a pure insertion. */
  readonly from: number;
  readonly to: number;
  readonly ours: string[];
  readonly theirs: string[];
  /** Display label of the author whose write caused the conflict (matches the attribution UI). */
  readonly label: string;
}

const setConflicts = StateEffect.define<ConflictItem[]>();
const clearAll = StateEffect.define();
const resolveOne = StateEffect.define<number>(); // id to remove

const conflictField = StateField.define<ConflictItem[]>({
  create: () => [],
  update(items, tr) {
    let next = tr.docChanged
      ? items.map((it) => ({
          ...it,
          from: tr.changes.mapPos(it.from, -1),
          to: tr.changes.mapPos(it.to, 1),
        }))
      : items;
    for (const effect of tr.effects) {
      if (effect.is(setConflicts)) next = effect.value;
      else if (effect.is(clearAll)) next = [];
      else if (effect.is(resolveOne)) next = next.filter((it) => it.id !== effect.value);
    }
    return next;
  },
});

/** True while unresolved conflict regions remain in the editor. */
export function hasConflicts(state: EditorState): boolean {
  return state.field(conflictField, false)?.length ? true : false;
}

function resolve(
  view: EditorView,
  id: number,
  choice: ResolutionChoice,
  onAllResolved: () => void,
): void {
  const item = view.state.field(conflictField).find((it) => it.id === id);
  if (!item) return;
  if (choice === 'ours') {
    // Keep whatever the region currently holds (our side, possibly hand-edited) — just clear it.
    view.dispatch({ effects: resolveOne.of(id) });
  } else {
    const insert = resolvedLines(item.ours, item.theirs, choice).join('\n');
    view.dispatch({ changes: { from: item.from, to: item.to, insert }, effects: resolveOne.of(id) });
  }
  if (view.state.field(conflictField).length === 0) onAllResolved();
}

class ConflictWidget extends WidgetType {
  constructor(
    private readonly item: ConflictItem,
    private readonly onAllResolved: () => void,
  ) {
    super();
  }

  override eq(other: ConflictWidget): boolean {
    return other.item.id === this.item.id && other.item.theirs.join('\n') === this.item.theirs.join('\n');
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cm-conflict';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Merge conflict — choose which version to keep');

    const head = document.createElement('div');
    head.className = 'cm-conflict__head';
    head.textContent = `Changed by ${this.item.label}`;
    root.appendChild(head);

    const actions = document.createElement('div');
    actions.className = 'cm-conflict__actions';
    const button = (label: string, choice: ResolutionChoice): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cm-conflict__btn';
      btn.textContent = label;
      btn.addEventListener('click', () => resolve(view, this.item.id, choice, this.onAllResolved));
      return btn;
    };
    actions.append(
      button('Keep mine', 'ours'),
      button('Keep theirs', 'theirs'),
      button('Keep both', 'both'),
    );
    root.appendChild(actions);

    const theirsLabel = document.createElement('div');
    theirsLabel.className = 'cm-conflict__label';
    theirsLabel.textContent = 'Their version:';
    root.appendChild(theirsLabel);

    const theirs = document.createElement('pre');
    theirs.className = 'cm-conflict__theirs';
    theirs.textContent = this.item.theirs.join('\n');
    root.appendChild(theirs);

    return root;
  }
}

const conflictLine = Decoration.line({ class: 'cm-conflict-line' });

function buildDecorations(state: EditorState, onAllResolved: () => void): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const item of state.field(conflictField)) {
    ranges.push(
      Decoration.widget({
        widget: new ConflictWidget(item, onAllResolved),
        block: true,
        side: -1,
      }).range(item.from),
    );
    if (item.to > item.from) {
      const first = state.doc.lineAt(item.from).number;
      const last = state.doc.lineAt(item.to).number;
      for (let n = first; n <= last; n++) {
        ranges.push(conflictLine.range(state.doc.line(n).from));
      }
    }
  }
  return Decoration.set(ranges, true);
}

function regionToItem(
  state: EditorState,
  region: ConflictRegion,
  id: number,
  label: string,
): ConflictItem {
  const doc = state.doc;
  const startLine = Math.min(region.startLine + 1, doc.lines); // 1-based
  const from = doc.line(startLine).from;
  const to = region.endLine > region.startLine ? doc.line(Math.min(region.endLine, doc.lines)).to : from;
  return { id, from, to, ours: region.ours, theirs: region.theirs, label };
}

/** CodeMirror extension that renders the resolver; `onAllResolved` fires when the last region is resolved. */
export function conflictResolver(onAllResolved: () => void): Extension {
  return [
    conflictField,
    EditorView.decorations.compute([conflictField], (state) => buildDecorations(state, onAllResolved)),
  ];
}

/** Overlay the resolver on the given conflict regions (buffer already shows our side). */
export function showConflicts(
  view: EditorView,
  regions: readonly ConflictRegion[],
  authorLabel: string,
): void {
  const items = regions.map((region, id) => regionToItem(view.state, region, id, authorLabel));
  view.dispatch({ effects: setConflicts.of(items) });
}

/** Remove any resolver overlay (e.g. after a clean reload or opening another file). */
export function clearConflicts(view: EditorView): void {
  view.dispatch({ effects: clearAll.of(null) });
}
