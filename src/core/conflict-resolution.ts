// Pure helpers for the interactive conflict resolver. The 3-way merge (three-way-merge.ts)
// yields ordered stable/conflict segments; given a per-conflict choice array (null = still
// unresolved), this composes the full document text and locates each unresolved conflict by
// line span — so the adapter recomputes both from state and never juggles character offsets.
// No DOM/CodeMirror here.

import type { MergeSegment } from './three-way-merge.js';

export type ResolutionChoice = 'ours' | 'theirs' | 'both';
/** A per-conflict decision; null while the conflict is still unresolved. */
export type Choice = ResolutionChoice | null;

export interface ConflictRegion {
  /** Position of this conflict among all conflicts (index into the choices array). */
  readonly index: number;
  /** Half-open [startLine, endLine) 0-based span in the composed document. */
  readonly startLine: number;
  readonly endLine: number;
  readonly ours: string[];
  readonly theirs: string[];
}

/** The lines a conflict resolves to for `choice` ('both' keeps ours then theirs). */
export function resolvedLines(ours: string[], theirs: string[], choice: ResolutionChoice): string[] {
  if (choice === 'ours') return ours;
  if (choice === 'theirs') return theirs;
  return [...ours, ...theirs];
}

/** How many conflict segments the merge produced (i.e. the length of the choices array). */
export function conflictCount(segments: MergeSegment[]): number {
  return segments.reduce((n, s) => (n + ('conflict' in s ? 1 : 0)), 0);
}

/** The full document for the given choices: stable lines, each conflict shown per its choice
 *  (or our side while unresolved). Joining lines means insertions never glue onto a line. */
export function composeResolved(segments: MergeSegment[], choices: readonly Choice[]): string {
  const lines: string[] = [];
  let conflictIndex = 0;
  for (const segment of segments) {
    if ('stable' in segment) {
      lines.push(...segment.stable);
      continue;
    }
    const choice = choices[conflictIndex++];
    const { ours, theirs } = segment.conflict;
    lines.push(...(choice ? resolvedLines(ours, theirs, choice) : ours));
  }
  return lines.join('\n');
}

/** Line spans (within composeResolved(segments, choices)) of the conflicts still unresolved. */
export function unresolvedRegions(
  segments: MergeSegment[],
  choices: readonly Choice[],
): ConflictRegion[] {
  const lines: string[] = [];
  const regions: ConflictRegion[] = [];
  let conflictIndex = 0;
  for (const segment of segments) {
    if ('stable' in segment) {
      lines.push(...segment.stable);
      continue;
    }
    const index = conflictIndex++;
    const { ours, theirs } = segment.conflict;
    const choice = choices[index];
    if (choice) {
      lines.push(...resolvedLines(ours, theirs, choice));
      continue;
    }
    const startLine = lines.length;
    lines.push(...ours);
    regions.push({ index, startLine, endLine: lines.length, ours, theirs });
  }
  return regions;
}
