import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl } from './external-link.js';

describe('isSafeExternalUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isSafeExternalUrl('  HTTPS://Example.com  ')).toBe(true);
  });

  it('rejects non-web schemes', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('mailto:x@y.com')).toBe(false);
    expect(isSafeExternalUrl('ftp://host/file')).toBe(false);
  });

  it('rejects relative, fragment, or empty inputs', () => {
    expect(isSafeExternalUrl('/relative/path')).toBe(false);
    expect(isSafeExternalUrl('#anchor')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
  });
});
