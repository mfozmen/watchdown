// Splits on / or \ itself so it works cross-platform without an fs dependency.

/** Title for the given file `path` (full path or null) and dirty state. */
export function windowTitle(path: string | null, isDirty: boolean): string {
  if (!path) return 'Watchdown';
  const name = path.split(/[/\\]/).pop() || path;
  return `${isDirty ? '● ' : ''}${name} — Watchdown`;
}
