// Cooperative authorship: a tool announces its edit through a hook (see claude-hook.ts), so
// attribution is exact, not guessed. The signal record is untrusted and validated here.

export interface AuthorshipSignal {
  readonly file: string;
  readonly author: string;
  readonly ts: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Fold case on Windows and macOS, whose default filesystems are case-insensitive. The caller
 * resolves the path to absolute first, since that needs the filesystem.
 */
export function canonicalizePath(absolutePath: string, platform: string): string {
  const caseInsensitive = platform === 'win32' || platform === 'darwin';
  return caseInsensitive ? absolutePath.toLowerCase() : absolutePath;
}

/**
 * Validate the untrusted signal file a hook wrote, or null if unusable. It holds only the edited
 * path, a timestamp and the author, never file contents.
 */
export function parseSignal(raw: string): AuthorshipSignal | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const { file, author, ts } = value;
  if (!isNonEmptyString(file) || !isNonEmptyString(author)) return null;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  return { file, author, ts };
}

/**
 * The author label to attribute an observed change to, or null to fall back to the configured
 * label. Matches when the signal names the same file and is close in time to the observation
 * (`abs` tolerates minor clock skew, since the hook fires just before the write is seen).
 *
 * Limitation: a single latest signal, matched by path + window. Rapid edits to *different*
 * files can lose the earlier signal (the later one overwrites it) — those fall back to the
 * generic label. Upgrade to an appended, per-file journal if multi-file attribution matters.
 */
export function attributedAuthor(
  signal: AuthorshipSignal | null,
  changedFile: string,
  now: number,
  windowMs: number,
): string | null {
  if (signal === null) return null;
  if (signal.file !== changedFile) return null;
  if (Math.abs(now - signal.ts) > windowMs) return null;
  return signal.author;
}
