import { describe, expect, it } from 'vitest';
import { parseThemePreference, THEME_MODES } from './theme-preference.js';

describe('parseThemePreference', () => {
  it('accepts each known mode', () => {
    for (const mode of THEME_MODES) expect(parseThemePreference(mode)).toBe(mode);
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(parseThemePreference('DARK')).toBe('dark');
    expect(parseThemePreference('  Light ')).toBe('light');
  });

  it('falls back to system for an unknown string', () => {
    expect(parseThemePreference('blue')).toBe('system');
    expect(parseThemePreference('')).toBe('system');
  });

  it('falls back to system for a non-string value', () => {
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(3)).toBe('system');
    expect(parseThemePreference({ theme: 'dark' })).toBe('system');
  });
});
