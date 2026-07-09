// Pure editing of a Claude Code settings object to add/remove Watchdown's PostToolUse hook.
// The hook lets Claude Code announce each edit so Watchdown can attribute it (see
// authorship-signal.ts). Kept pure and immutable so the adapter's read-merge-write of the
// user's settings.json is fully tested and can't clobber their other hooks or keys.

export const HOOK_MATCHER = 'Write|Edit|MultiEdit';
// Identifies our hook within settings regardless of the absolute script path (which is
// machine-specific): the adapter always points the command at a file with this name.
export const HOOK_COMMAND_MARKER = 'claude-hook.mjs';

interface HookEntry {
  readonly type: string;
  readonly command: string;
}
interface HookGroup {
  readonly matcher?: string;
  readonly hooks: readonly HookEntry[];
}
export interface ClaudeSettings {
  hooks?: { PostToolUse?: HookGroup[] } & Record<string, HookGroup[]>;
  [key: string]: unknown;
}

const isOurs = (entry: HookEntry): boolean => entry.command.includes(HOOK_COMMAND_MARKER);

/** Whether Watchdown's hook is already installed in these settings. */
export function hasClaudeHook(settings: ClaudeSettings): boolean {
  const groups = settings.hooks?.PostToolUse ?? [];
  return groups.some((group) => group.hooks.some(isOurs));
}

/** Return settings with our PostToolUse hook added (no-op if already present). */
export function addClaudeHook(settings: ClaudeSettings, command: string): ClaudeSettings {
  if (hasClaudeHook(settings)) return settings;
  const group: HookGroup = { matcher: HOOK_MATCHER, hooks: [{ type: 'command', command }] };
  const existing = settings.hooks?.PostToolUse ?? [];
  return { ...settings, hooks: { ...settings.hooks, PostToolUse: [...existing, group] } };
}

/** Return settings with our hook removed, pruning any group/hooks object it leaves empty. */
export function removeClaudeHook(settings: ClaudeSettings): ClaudeSettings {
  const groups = settings.hooks?.PostToolUse;
  if (!groups) return settings;
  const pruned = groups
    .map((group) => ({ ...group, hooks: group.hooks.filter((entry) => !isOurs(entry)) }))
    .filter((group) => group.hooks.length > 0);
  const hooks: Record<string, HookGroup[]> = { ...settings.hooks };
  if (pruned.length > 0) hooks.PostToolUse = pruned;
  else delete hooks.PostToolUse;
  const next: ClaudeSettings = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  return next;
}
