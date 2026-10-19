// The preferences file is user-editable, so its value is validated here.

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const DEFAULT_MODE: ThemeMode = 'system';

/** Coerce an untrusted persisted value to a known mode, defaulting to 'system'. */
export function parseThemePreference(value: unknown): ThemeMode {
  if (typeof value !== 'string') return DEFAULT_MODE;
  const normalized = value.trim().toLowerCase();
  return (THEME_MODES as readonly string[]).includes(normalized)
    ? (normalized as ThemeMode)
    : DEFAULT_MODE;
}
