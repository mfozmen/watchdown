import { describe, expect, it } from 'vitest';
import { resolveAuthorLabel } from './author-label.js';

describe('resolveAuthorLabel', () => {
  it('reads --author <value>', () => {
    expect(resolveAuthorLabel(['electron', '.', '--author', 'Claude'], undefined)).toBe('Claude');
  });

  it('reads --author=<value>', () => {
    expect(resolveAuthorLabel(['--author=Claude Code'], undefined)).toBe('Claude Code');
  });

  it('falls back to the environment value', () => {
    expect(resolveAuthorLabel([], 'Claude')).toBe('Claude');
  });

  it('prefers the CLI flag over the environment', () => {
    expect(resolveAuthorLabel(['--author', 'Claude'], 'Other')).toBe('Claude');
  });

  it('defaults to a generic label when nothing is provided', () => {
    expect(resolveAuthorLabel([], undefined)).toBe('an external tool');
  });

  it('ignores a blank value and a valueless flag', () => {
    expect(resolveAuthorLabel(['--author', '   '], undefined)).toBe('an external tool');
    expect(resolveAuthorLabel(['--author'], undefined)).toBe('an external tool');
    expect(resolveAuthorLabel([], '  ')).toBe('an external tool');
  });

  it('does not swallow a following flag as the author value', () => {
    expect(resolveAuthorLabel(['--author', '--other-flag'], undefined)).toBe('an external tool');
  });
});
