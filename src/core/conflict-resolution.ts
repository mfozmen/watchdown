// Pure helpers for the interactive conflict resolver. The 3-way merge (three-way-merge.ts)
// yields ordered stable/conflict segments; this turns them into the editor's "ours" view
// plus the line span of each conflict (so the adapter can place resolve widgets), and maps
// a per-conflict choice to its resulting lines. No DOM/CodeMirror here.

import type { MergeSegment } from './three-way-merge.js';

export type ResolutionChoice = 'ours' | 'theirs' | 'both';

export interface ConflictRegion {
  /** Half-open [startLine, endLine) 0-based span in the composed (ours) document. */
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

/**
 * Compose the initial editor text (stable lines, with each conflict shown as OUR side) and
 * locate every conflict by its line span within that text.
 */
export function locateConflicts(segments: MergeSegment[]): {
  text: string;
  regions: ConflictRegion[];
} {
  const lines: string[] = [];
  const regions: ConflictRegion[] = [];
  for (const segment of segments) {
    if ('stable' in segment) {
      lines.push(...segment.stable);
      continue;
    }
    const startLine = lines.length;
    lines.push(...segment.conflict.ours);
    regions.push({
      startLine,
      endLine: lines.length,
      ours: segment.conflict.ours,
      theirs: segment.conflict.theirs,
    });
  }
  return { text: lines.join('\n'), regions };
}
