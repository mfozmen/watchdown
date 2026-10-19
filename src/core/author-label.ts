// A disk write carries no author, so the label is configured instead. `--author` beats
// WATCHDOWN_AUTHOR, and blanks fall through to the default.

const DEFAULT_LABEL = 'an external tool';

function readAuthorFlag(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--author') {
      const value = argv[i + 1];
      return value?.startsWith('--') ? undefined : value; // don't consume a following flag
    }
    if (arg?.startsWith('--author=')) return arg.slice('--author='.length);
  }
  return undefined;
}

/** The external-author label from `--author`/`WATCHDOWN_AUTHOR`, else a generic default. */
export function resolveAuthorLabel(argv: readonly string[], envValue: string | undefined): string {
  const label = (readAuthorFlag(argv) ?? envValue ?? '').trim();
  return label || DEFAULT_LABEL;
}
