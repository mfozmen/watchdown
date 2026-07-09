// Pure validation of the persisted appearance preference. 'system' follows the OS (via
// nativeTheme.themeSource in the adapter); 'light'/'dark' force a mode. Kept pure so the
// adapter's read of a user-editable preferences file is guarded and tested.

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
