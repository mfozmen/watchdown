import { describe, expect, it } from 'vitest';
import {
  threeWayMerge,
  type ConflictSegment,
  type ThreeWayMergeResult,
} from './three-way-merge.js';

// Flatten the agreed lines of a fully-merged (conflict-free) result.
const mergedLines = (r: ThreeWayMergeResult): string[] =>
  r.segments.flatMap((s) => ('stable' in s ? s.stable : []));

describe('threeWayMerge', () => {
  it('keeps ours when only ours changed', () => {
    const r = threeWayMerge('a\nb\nc', 'a\nB\nc', 'a\nb\nc');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', 'B', 'c']);
  });

  it('keeps theirs when only theirs changed', () => {
    const r = threeWayMerge('a\nb\nc', 'a\nb\nc', 'a\nb\nC');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', 'b', 'C']);
  });

  it('auto-merges non-overlapping concurrent changes', () => {
    const r = threeWayMerge('a\nb\nc\nd\ne', 'A\nb\nc\nd\ne', 'a\nb\nc\nd\nE');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['A', 'b', 'c', 'd', 'E']);
  });

  it('reports a conflict for competing changes on the same line', () => {
    const r = threeWayMerge('a\nb\nc', 'a\nOURS\nc', 'a\nTHEIRS\nc');

    expect(r.hasConflict).toBe(true);
    const seg = r.segments.find((s): s is ConflictSegment => 'conflict' in s);
    expect(seg?.conflict).toEqual({ base: ['b'], ours: ['OURS'], theirs: ['THEIRS'] });
  });

  it('does not conflict when both sides make the identical change', () => {
    const r = threeWayMerge('a\nb\nc', 'a\nSAME\nc', 'a\nSAME\nc');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', 'SAME', 'c']);
  });

  it('handles empty base without error', () => {
    const r = threeWayMerge('', 'hello', '');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['hello']);
  });

  it('merges three empty documents to no lines (no phantom blank line)', () => {
    const r = threeWayMerge('', '', '');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual([]);
  });
});
