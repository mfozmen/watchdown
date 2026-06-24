// Pure line-level 3-way merge producing structured segments — our own result
// shape so the underlying diff engine stays swappable. No git-style text markers
// here; that rendering is a later presentation concern. No fs/DOM/timers.

import { diff3Merge } from 'node-diff3';

/** A run of agreed lines that needs no resolution. */
export interface StableSegment {
  readonly stable: string[];
}

/** A region where ours and theirs diverged; carries all three sides to resolve. */
export interface ConflictSegment {
  readonly conflict: {
    readonly base: string[];
    readonly ours: string[];
    readonly theirs: string[];
  };
}

export type MergeSegment = StableSegment | ConflictSegment;

export interface ThreeWayMergeResult {
  readonly segments: MergeSegment[];
  readonly hasConflict: boolean;
}

/** Merge base/ours/theirs at line granularity into ordered stable/conflict segments. */
export function threeWayMerge(
  base: string,
  ours: string,
  theirs: string,
): ThreeWayMergeResult {
  // Split lines ourselves so node-diff3 merges per line, not on whitespace.
  // An empty document is zero lines, not one phantom blank line.
  const lines = (text: string): string[] => (text === '' ? [] : text.split('\n'));

  // node-diff3's diff3Merge(a, o, b) takes the ORIGINAL/base as the MIDDLE arg.
  // Mapping is intentional and must not be transposed: a = ours, o = base, b = theirs.
  const regions = diff3Merge(lines(ours), lines(base), lines(theirs), {
    excludeFalseConflicts: true,
  });

  const segments: MergeSegment[] = regions.map((region) =>
    region.conflict
      ? {
          conflict: {
            base: region.conflict.o,
            ours: region.conflict.a,
            theirs: region.conflict.b,
          },
        }
      : { stable: region.ok ?? [] },
  );

  return { segments, hasConflict: segments.some((s) => 'conflict' in s) };
}
