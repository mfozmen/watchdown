// CodeMirror glue for the interactive conflict resolver. On a conflict the buffer already
// shows OUR side; this overlays, above each unresolved region, a block widget with
// "Keep mine / Keep theirs / Keep both" buttons and highlights the region. Resolving a
// region recomposes the whole buffer from the pure core (so line insertions and trailing
// regions can never be mispositioned) and re-derives the remaining widgets; when the last
// region is resolved, onAllResolved() fires.
//
// Thin adapter: all text composition and region layout come from conflict-resolution.ts;
// this only maps line spans to positions, renders, and dispatches.

import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import {
  composeResolved,
  conflictCount,
  unresolvedRegions,
  type Choice,
  type ConflictRegion,
  type ResolutionChoice,
} from '../../core/conflict-resolution.js';
import type { MergeSegment } from '../../core/three-way-merge.js';

interface ConflictData {
  readonly segments: MergeSegment[];
  readonly choices: Choice[];
  readonly label: string;
}

const NO_DATA: ConflictData = { segments: [], choices: [], label: '' };

const setConflicts = StateEffect.define<{ segments: MergeSegment[]; label: string }>();
const setChoice = StateEffect.define<{ index: number; choice: ResolutionChoice }>();
const clearAll = StateEffect.define();

const dataField = StateField.define<ConflictData>({
  create: () => NO_DATA,
  update(data, tr) {
    let next = data;
    for (const effect of tr.effects) {
      if (effect.is(setConflicts)) {
        next = {
          segments: effect.value.segments,
          choices: Array<Choice>(conflictCount(effect.value.segments)).fill(null),
          label: effect.value.label,
        };
      } else if (effect.is(clearAll)) {
        next = NO_DATA;
      } else if (effect.is(setChoice)) {
        const choices = next.choices.slice();
        choices[effect.value.index] = effect.value.choice;
        next = { ...next, choices };
      }
    }
    return next;
  },
});

function hasUnresolved(data: ConflictData): boolean {
  return data.choices.length > 0 && data.choices.some((c) => c === null);
}

function resolve(
  view: EditorView,
  index: number,
  choice: ResolutionChoice,
  onAllResolved: () => void,
): void {
  const data = view.state.field(dataField);
  const choices = data.choices.slice();
  choices[index] = choice;
  const text = composeResolved(data.segments, choices);
  const scrollTop = view.scrollDOM.scrollTop; // recomposing replaces the whole doc — keep the view put
  const caret = Math.min(view.state.selection.main.head, text.length);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: caret },
    effects: setChoice.of({ index, choice }),
  });
  view.scrollDOM.scrollTop = scrollTop;
  if (!hasUnresolved(view.state.field(dataField))) onAllResolved();
}

class ConflictWidget extends WidgetType {
  constructor(
    private readonly region: ConflictRegion,
    private readonly label: string,
    private readonly onAllResolved: () => void,
  ) {
    super();
  }

  override eq(other: ConflictWidget): boolean {
    return (
      other.region.index === this.region.index &&
      other.label === this.label &&
      other.region.theirs.join('\n') === this.region.theirs.join('\n')
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cm-conflict';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Merge conflict — choose which version to keep');

    const head = document.createElement('div');
    head.className = 'cm-conflict__head';
    head.textContent = `Changed by ${this.label}`;
    root.appendChild(head);

    const actions = document.createElement('div');
    actions.className = 'cm-conflict__actions';
    const button = (text: string, choice: ResolutionChoice): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cm-conflict__btn';
      btn.textContent = text;
      btn.addEventListener('click', () =>
        resolve(view, this.region.index, choice, this.onAllResolved),
      );
      return btn;
    };
    actions.append(
      button('Keep mine', 'ours'),
      button('Keep theirs', 'theirs'),
      button('Keep both', 'both'),
    );
    root.appendChild(actions);

    // Show both sides, labelled, so the choice is legible without decoding the highlight.
    const versionBlock = (text: string, lines: string[]): void => {
      const label = document.createElement('div');
      label.className = 'cm-conflict__label';
      label.textContent = text;
      const pre = document.createElement('pre');
      pre.className = 'cm-conflict__version';
      pre.textContent = lines.length ? lines.join('\n') : '(nothing — these lines are removed)';
      root.append(label, pre);
    };
    versionBlock('Your version:', this.region.ours);
    versionBlock('Their version:', this.region.theirs);

    return root;
  }
}

const conflictLine = Decoration.line({ class: 'cm-conflict-line' });

function buildDecorations(state: EditorState, onAllResolved: () => void): DecorationSet {
  const data = state.field(dataField);
  const doc = state.doc;
  const ranges: Range<Decoration>[] = [];
  for (const region of unresolvedRegions(data.segments, data.choices)) {
    const atEnd = region.startLine >= doc.lines; // trailing insertion sits after the last line
    const pos = atEnd ? doc.length : doc.line(region.startLine + 1).from;
    ranges.push(
      Decoration.widget({
        widget: new ConflictWidget(region, data.label, onAllResolved),
        block: true,
        side: atEnd ? 1 : -1,
      }).range(pos),
    );
    if (region.endLine > region.startLine) {
      const last = Math.min(region.endLine, doc.lines);
      for (let n = region.startLine + 1; n <= last; n++) {
        ranges.push(conflictLine.range(doc.line(n).from));
      }
    }
  }
  return Decoration.set(ranges, true);
}

function decorationField(onAllResolved: () => void): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state, onAllResolved),
    update(deco, tr) {
      const touched = tr.effects.some(
        (e) => e.is(setConflicts) || e.is(setChoice) || e.is(clearAll),
      );
      return tr.docChanged || touched ? buildDecorations(tr.state, onAllResolved) : deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

/** CodeMirror extension that renders the resolver; `onAllResolved` fires when the last region is resolved. */
export function conflictResolver(onAllResolved: () => void): Extension {
  return [
    dataField,
    decorationField(onAllResolved),
    // While regions are unresolved the buffer is resolver-managed — make it read-only so
    // typing can't be silently discarded when resolving recomposes the document.
    EditorView.editable.from(dataField, (data) => !hasUnresolved(data)),
  ];
}

/** Overlay the resolver for the given merge segments (buffer already shows our side). */
export function showConflicts(view: EditorView, segments: MergeSegment[], authorLabel: string): void {
  view.dispatch({ effects: setConflicts.of({ segments, label: authorLabel }) });
}

/** Remove any resolver overlay (e.g. after a clean reload or opening another file). */
export function clearConflicts(view: EditorView): void {
  view.dispatch({ effects: clearAll.of(null) });
}
