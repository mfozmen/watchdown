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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Canonicalize an absolute path for equality comparison. Windows paths are case-insensitive,
 * so fold case there; leave other platforms untouched. The caller resolves to absolute first
 * (that needs the filesystem/cwd); this stays pure so the platform rule is unit-tested.
 */
export function canonicalizePath(absolutePath: string, platform: string): string {
  return platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
}

/**
 * Parse the signal file written by the Claude Code hook. The hook is trivial glue: it wraps its
 * raw stdin (Claude's PostToolUse payload) with a timestamp and author. The real work — pulling
 * the edited file out of that payload and validating everything — lives here so it's tested,
 * keeping the standalone hook script free of logic. Returns null if the record is unusable.
 */
export function parseSignal(raw: string): AuthorshipSignal | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const { ts, author, payload } = value;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  if (!isNonEmptyString(author)) return null;
  if (!isObject(payload) || !isObject(payload['tool_input'])) return null;
  const file = payload['tool_input']['file_path'];
  if (!isNonEmptyString(file)) return null;
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
