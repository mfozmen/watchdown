import { describe, expect, it } from 'vitest';
import { resolvedLines, locateConflicts } from './conflict-resolution.js';
import type { MergeSegment } from './three-way-merge.js';

const conflict = (ours: string[], theirs: string[]): MergeSegment => ({
  conflict: { base: [], ours, theirs },
});
const stable = (...lines: string[]): MergeSegment => ({ stable: lines });

describe('resolvedLines', () => {
  const ours = ['mine'];
  const theirs = ['yours'];

  it('keeps ours', () => {
    expect(resolvedLines(ours, theirs, 'ours')).toEqual(['mine']);
  });

  it('keeps theirs', () => {
    expect(resolvedLines(ours, theirs, 'theirs')).toEqual(['yours']);
  });

  it('keeps both, ours before theirs', () => {
    expect(resolvedLines(ours, theirs, 'both')).toEqual(['mine', 'yours']);
  });
});

describe('locateConflicts', () => {
  it('returns just the text and no regions when there are no conflicts', () => {
    const result = locateConflicts([stable('a', 'b')]);

    expect(result.text).toBe('a\nb');
    expect(result.regions).toEqual([]);
  });

  it('composes the ours view and locates a conflict by line span', () => {
    const segments = [stable('a', 'b'), conflict(['ourX'], ['theirY', 'theirZ']), stable('c')];

    const result = locateConflicts(segments);

    // The buffer shows OUR side of the conflict (ourX), between the stable lines.
    expect(result.text).toBe('a\nb\nourX\nc');
    expect(result.regions).toEqual([
      { startLine: 2, endLine: 3, ours: ['ourX'], theirs: ['theirY', 'theirZ'] },
    ]);
  });

  it('locates multiple conflicts with spans in the composed document', () => {
    const segments = [
      conflict(['o1'], ['t1']),
      stable('mid'),
      conflict(['o2a', 'o2b'], ['t2']),
    ];

    const result = locateConflicts(segments);

    expect(result.text).toBe('o1\nmid\no2a\no2b');
    expect(result.regions).toEqual([
      { startLine: 0, endLine: 1, ours: ['o1'], theirs: ['t1'] },
      { startLine: 2, endLine: 4, ours: ['o2a', 'o2b'], theirs: ['t2'] },
    ]);
  });
});
