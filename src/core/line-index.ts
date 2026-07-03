// Pure conversion of a 0-based line index to a CodeMirror 1-based line number, clamped to
// the document's line count. Extracted from the editor glue so the index math is tested.

/** Convert `zeroBasedIndex` to a 1-based line number, clamped to `[1, max(1, lineCount)]`. */
export function clampToLineNumber(zeroBasedIndex: number, lineCount: number): number {
  const maxIndex = Math.max(0, lineCount - 1);
  return Math.min(Math.max(zeroBasedIndex, 0), maxIndex) + 1;
}
