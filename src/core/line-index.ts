// Pure conversion of a 0-based line index to a CodeMirror 1-based line number, clamped to
// the document's line count. Extracted from the editor glue so the index math is tested.

/** Convert `zeroBasedIndex` to a 1-based line number, clamped to `[1, max(1, lineCount)]`. */
export function clampToLineNumber(_zeroBasedIndex: number, _lineCount: number): number {
  throw new Error('clampToLineNumber is not implemented yet');
}
