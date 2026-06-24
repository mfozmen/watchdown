// Pure line-level 3-way merge producing structured segments — our own result
// shape so the underlying diff engine stays swappable. No git-style text markers
// here; that rendering is a later presentation concern. No fs/DOM/timers.

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
  _base: string,
  _ours: string,
  _theirs: string,
): ThreeWayMergeResult {
  throw new Error('threeWayMerge is not implemented yet');
}
