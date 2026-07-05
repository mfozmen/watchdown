// Pure window/tab title derivation: the open file's name plus an unsaved marker. Splits
// the path itself (on / or \) so it's cross-platform and testable, with no fs dependency.

/** Title for the given file `path` (full path or null) and dirty state. */
export function windowTitle(path: string | null, isDirty: boolean): string {
  if (!path) return 'Watchdown';
  const name = path.split(/[/\\]/).pop() || path;
  return `${isDirty ? '● ' : ''}${name} — Watchdown`;
}
