// Cursor's hook shape differs from Claude's: a flat afterFileEdit array of { command } plus a
// required top-level `version`. Immutable so read-merge-write can't clobber the user's other hooks.

export const CURSOR_HOOK_EVENT = 'afterFileEdit';
// Identifies our hook regardless of the machine-specific absolute script path.
export const CURSOR_HOOK_COMMAND_MARKER = 'cursor-hook.mjs';
const CURSOR_HOOKS_VERSION = 1; // required by Cursor for hooks to be honored

interface CursorHookEntry {
  readonly command: string;
  readonly [key: string]: unknown; // preserve a user entry's timeout/type/etc
}
export interface CursorSettings {
  version?: number;
  hooks?: { afterFileEdit?: CursorHookEntry[] } & Record<string, CursorHookEntry[]>;
  [key: string]: unknown;
}

const isOurs = (entry: CursorHookEntry): boolean =>
  entry.command.includes(CURSOR_HOOK_COMMAND_MARKER);

/** Whether Watchdown's afterFileEdit hook is already installed in these settings. */
export function hasCursorHook(settings: CursorSettings): boolean {
  const entries = settings.hooks?.afterFileEdit ?? [];
  return entries.some(isOurs);
}

/** Return settings with our afterFileEdit hook added (no-op if already present). Ensures the
 * required top-level version is set so a fresh config actually runs the hook. */
export function addCursorHook(settings: CursorSettings, command: string): CursorSettings {
  if (hasCursorHook(settings)) return settings;
  const existing = settings.hooks?.afterFileEdit ?? [];
  return {
    ...settings,
    version: settings.version ?? CURSOR_HOOKS_VERSION,
    hooks: { ...settings.hooks, afterFileEdit: [...existing, { command }] },
  };
}

/** Return settings with our hook removed, pruning the emptied array/hooks object. `version` is
 * a valid Cursor field, so it's left as-is rather than guessed to be ours. */
export function removeCursorHook(settings: CursorSettings): CursorSettings {
  const entries = settings.hooks?.afterFileEdit;
  if (!entries) return settings;
  const pruned = entries.filter((entry) => !isOurs(entry));
  const hooks: Record<string, CursorHookEntry[]> = { ...settings.hooks };
  if (pruned.length > 0) hooks.afterFileEdit = pruned;
  else delete hooks.afterFileEdit;
  const next: CursorSettings = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  return next;
}
