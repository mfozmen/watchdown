import { describe, expect, it } from 'vitest';
import {
  resolvedLines,
  conflictCount,
  composeResolved,
  unresolvedRegions,
} from './conflict-resolution.js';
import type { MergeSegment } from './three-way-merge.js';

const conflict = (ours: string[], theirs: string[]): MergeSegment => ({
  conflict: { base: [], ours, theirs },
});
const stable = (...lines: string[]): MergeSegment => ({ stable: lines });

describe('resolvedLines', () => {
  it('keeps ours, theirs, or both (ours before theirs)', () => {
    expect(resolvedLines(['mine'], ['yours'], 'ours')).toEqual(['mine']);
    expect(resolvedLines(['mine'], ['yours'], 'theirs')).toEqual(['yours']);
    expect(resolvedLines(['mine'], ['yours'], 'both')).toEqual(['mine', 'yours']);
  });
});

describe('conflictCount', () => {
  it('counts only the conflict segments', () => {
    expect(conflictCount([stable('a'), conflict(['o'], ['t']), stable('b')])).toBe(1);
    expect(conflictCount([stable('a')])).toBe(0);
  });
});

describe('composeResolved', () => {
  it('shows our side for unresolved conflicts', () => {
    const segs = [stable('a'), conflict(['o'], ['t']), stable('b')];

    expect(composeResolved(segs, [null])).toBe('a\no\nb');
  });

  it('applies a per-conflict choice', () => {
    const segs = [stable('a'), conflict(['o'], ['t']), stable('b')];

    expect(composeResolved(segs, ['theirs'])).toBe('a\nt\nb');
    expect(composeResolved(segs, ['both'])).toBe('a\no\nt\nb');
  });

  it('appends a resolved trailing insertion (empty ours) without gluing lines', () => {
    // ours removed the trailing region that theirs modified → conflict with empty ours at the end
    const segs = [stable('a'), conflict([], ['x', 'y'])];

    expect(composeResolved(segs, [null])).toBe('a'); // unresolved: nothing shown for empty ours
    expect(composeResolved(segs, ['theirs'])).toBe('a\nx\ny'); // resolved: appended as new lines
  });
});

describe('unresolvedRegions', () => {
  it('locates each unresolved conflict by line span and index', () => {
    const segs = [stable('a', 'b'), conflict(['o'], ['t1', 't2']), stable('c')];

    expect(unresolvedRegions(segs, [null])).toEqual([
      { index: 0, startLine: 2, endLine: 3, ours: ['o'], theirs: ['t1', 't2'] },
    ]);
  });

  it('omits resolved conflicts and shifts later spans by the resolved size', () => {
    const segs = [conflict(['o1'], ['t1a', 't1b']), stable('m'), conflict(['o2'], ['t2'])];

    // resolve the first as theirs (2 lines) → the second conflict shifts down one line
    expect(unresolvedRegions(segs, ['theirs', null])).toEqual([
      { index: 1, startLine: 3, endLine: 4, ours: ['o2'], theirs: ['t2'] },
    ]);
  });

  it('locates a trailing empty-ours conflict as a zero-width span at the end', () => {
    const segs = [stable('a'), conflict([], ['x'])];

    expect(unresolvedRegions(segs, [null])).toEqual([
      { index: 0, startLine: 1, endLine: 1, ours: [], theirs: ['x'] },
    ]);
  });
});
