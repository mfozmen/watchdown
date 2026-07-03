import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relative-time.js';

const NOW = 1_000_000_000_000;
const ago = (ms: number): string => formatRelativeTime(NOW - ms, NOW);

describe('formatRelativeTime', () => {
  it('says "just now" for under a second', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(500)).toBe('just now');
  });

  it('formats seconds', () => {
    expect(ago(2_000)).toBe('2s ago');
    expect(ago(59_000)).toBe('59s ago');
  });

  it('formats minutes', () => {
    expect(ago(90_000)).toBe('1m ago');
    expect(ago(59 * 60_000)).toBe('59m ago');
  });

  it('formats hours', () => {
    expect(ago(2 * 3_600_000)).toBe('2h ago');
  });

  it('formats days', () => {
    expect(ago(3 * 86_400_000)).toBe('3d ago');
  });

  it('treats a future timestamp as just now', () => {
    expect(formatRelativeTime(NOW + 5_000, NOW)).toBe('just now');
  });
});
