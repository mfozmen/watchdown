// Cooperative authorship: a tool that edits the open file can announce it, so attribution is
// exact rather than guessed. Claude Code does this via a PostToolUse hook (see claude-hook.ts)
// that writes a signal record; here we validate that (untrusted) record and decide whether it
// explains an observed disk change.

export interface AuthorshipSignal {
  readonly file: string;
  readonly author: string;
  readonly ts: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Parse the signal file's JSON text into a validated record, or null if it's unusable. */
export function parseSignal(raw: string): AuthorshipSignal | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { file, author, ts } = value as Record<string, unknown>;
  if (!isNonEmptyString(file) || !isNonEmptyString(author)) return null;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  return { file, author, ts };
}

/**
 * The author label to attribute an observed change to, or null to fall back to the configured
 * label. Matches when the signal names the same file and is close in time to the observation
 * (`abs` tolerates minor clock skew, since the hook fires just before the write is seen).
 *
 * ponytail: single latest signal, matched by path + window. Rapid edits to *different* files
 * can lose the earlier signal (the later one overwrites it) — those fall back to the generic
 * label. Upgrade to an appended, per-file journal if multi-file attribution matters.
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
