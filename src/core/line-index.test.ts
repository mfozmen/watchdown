import { describe, expect, it } from 'vitest';
import { clampToLineNumber } from './line-index.js';

describe('clampToLineNumber', () => {
  it('converts a 0-based index to a 1-based line number', () => {
    expect(clampToLineNumber(0, 5)).toBe(1);
    expect(clampToLineNumber(2, 5)).toBe(3);
    expect(clampToLineNumber(4, 5)).toBe(5);
  });

  it('clamps an index past the end to the last line', () => {
    expect(clampToLineNumber(10, 5)).toBe(5);
  });

  it('clamps a negative index to the first line', () => {
    expect(clampToLineNumber(-3, 5)).toBe(1);
  });

  it('returns line 1 for a single-line document', () => {
    expect(clampToLineNumber(3, 1)).toBe(1);
  });
});
