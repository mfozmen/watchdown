import { describe, expect, it } from 'vitest';
import { scrollRatio, scrollTopForRatio } from './scroll-sync.js';

describe('scrollRatio', () => {
  it('is 0 at the top and 1 at the bottom', () => {
    expect(scrollRatio(0, 1000, 400)).toBe(0);
    expect(scrollRatio(600, 1000, 400)).toBe(1); // 600 / (1000 - 400)
  });

  it('is proportional in between', () => {
    expect(scrollRatio(300, 1000, 400)).toBe(0.5);
  });

  it('is 0 when the content fits (nothing to scroll)', () => {
    expect(scrollRatio(0, 300, 400)).toBe(0);
    expect(scrollRatio(50, 300, 400)).toBe(0);
  });

  it('clamps to [0, 1]', () => {
    expect(scrollRatio(9999, 1000, 400)).toBe(1);
    expect(scrollRatio(-50, 1000, 400)).toBe(0);
  });
});

describe('scrollTopForRatio', () => {
  it('maps a ratio back to a scrollTop', () => {
    expect(scrollTopForRatio(0, 1000, 400)).toBe(0);
    expect(scrollTopForRatio(0.5, 1000, 400)).toBe(300);
    expect(scrollTopForRatio(1, 1000, 400)).toBe(600);
  });

  it('never returns a negative scrollTop when the content fits', () => {
    expect(scrollTopForRatio(0.5, 300, 400)).toBe(0);
  });
});
