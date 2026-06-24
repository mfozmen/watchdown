import { describe, expect, it } from 'vitest';
import {
  threeWayMerge,
  type ConflictSegment,
  type ThreeWayMergeResult,
} from './three-way-merge.js';

// Flatten the agreed lines of a fully-merged (conflict-free) result.
const mergedLines = (r: ThreeWayMergeResult): string[] =>
  r.segments.flatMap((s) => ('stable' in s ? s.stable : []));

// Collect the conflict payloads in order.
const conflicts = (r: ThreeWayMergeResult): ConflictSegment['conflict'][] =>
  r.segments.flatMap((s) => ('conflict' in s ? [s.conflict] : []));

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

  it('auto-merges a line inserted by one side', () => {
    const r = threeWayMerge('a\nc', 'a\nb\nc', 'a\nc');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', 'b', 'c']);
  });

  it('auto-merges a line deleted by one side', () => {
    const r = threeWayMerge('a\nb\nc', 'a\nc', 'a\nb\nc');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', 'c']);
  });

  it('keeps both concurrent insertions at different positions', () => {
    const r = threeWayMerge('a\nb\nc\nd', 'a\nX\nb\nc\nd', 'a\nb\nc\nY\nd');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', 'X', 'b', 'c', 'Y', 'd']);
  });

  it('reports two separate conflicts for two disjoint competing regions', () => {
    const r = threeWayMerge('a\nb\nc\nd\ne', 'a\nB1\nc\nD1\ne', 'a\nB2\nc\nD2\ne');

    expect(r.hasConflict).toBe(true);
    expect(conflicts(r)).toEqual([
      { base: ['b'], ours: ['B1'], theirs: ['B2'] },
      { base: ['d'], ours: ['D1'], theirs: ['D2'] },
    ]);
  });

  it('captures multi-line slices in a conflict', () => {
    const r = threeWayMerge('a\nb\nc\nd', 'a\nX\nY\nd', 'a\nP\nQ\nd');

    expect(r.hasConflict).toBe(true);
    expect(conflicts(r)).toEqual([{ base: ['b', 'c'], ours: ['X', 'Y'], theirs: ['P', 'Q'] }]);
  });

  it('treats a trailing newline as a trailing empty line', () => {
    const r = threeWayMerge('a', 'a\n', 'a');

    expect(r.hasConflict).toBe(false);
    expect(mergedLines(r)).toEqual(['a', '']);
  });
});
