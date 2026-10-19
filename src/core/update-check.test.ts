import { describe, expect, it } from 'vitest';
import { newerRelease } from './update-check.js';

const release = (tag: unknown, url: unknown = 'https://github.com/mfozmen/watchdown/releases/x') => ({
  tag_name: tag,
  html_url: url,
});

describe('newerRelease', () => {
  it('returns the release when its version is newer', () => {
    expect(newerRelease(release('v1.1.0'), '1.0.0')).toEqual({
      version: '1.1.0',
      url: 'https://github.com/mfozmen/watchdown/releases/x',
    });
  });

  it('compares each part numerically, not lexically', () => {
    expect(newerRelease(release('v1.10.0'), '1.9.9')?.version).toBe('1.10.0');
    expect(newerRelease(release('v2.0.0'), '1.99.99')?.version).toBe('2.0.0');
  });

  it('returns null when the release is the same or older', () => {
    expect(newerRelease(release('v1.0.0'), '1.0.0')).toBeNull();
    expect(newerRelease(release('v0.9.9'), '1.0.0')).toBeNull();
  });

  it('accepts a tag without the v prefix', () => {
    expect(newerRelease(release('1.0.1'), '1.0.0')?.version).toBe('1.0.1');
  });

  it('returns null for a malformed or untrusted payload', () => {
    expect(newerRelease(null, '1.0.0')).toBeNull();
    expect(newerRelease('nope', '1.0.0')).toBeNull();
    expect(newerRelease(release('latest'), '1.0.0')).toBeNull();
    expect(newerRelease(release(42), '1.0.0')).toBeNull();
    expect(newerRelease(release('v9.0.0', 42), '1.0.0')).toBeNull();
  });

  it('rejects a release url that is not https', () => {
    expect(newerRelease(release('v9.0.0', 'javascript:alert(1)'), '1.0.0')).toBeNull();
  });
});
