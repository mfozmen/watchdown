// Pure, immutable editing of a settings object shaped like Claude Code's and Gemini CLI's:
//   { hooks: { <Event>: [ { matcher, hooks: [ { type: 'command', command } ] } ] } }
// A NestedHookSpec captures the only per-tool differences — the lifecycle event, the tool-name
// matcher, and the command marker that identifies our hook regardless of its machine-specific
// path. Kept pure so the adapter's read-merge-write of a user's settings can't clobber their
// other hooks or keys.

export interface NestedHookSpec {
  readonly event: string; // e.g. 'PostToolUse' (Claude) / 'AfterTool' (Gemini)
  readonly matcher: string; // tool-name regex, e.g. 'Write|Edit|MultiEdit' / 'write_file|replace'
  readonly marker: string; // substring identifying our hook command, e.g. 'claude-hook.mjs'
}

interface HookEntry {
  readonly type: string;
  readonly command: string;
}
interface HookGroup {
  readonly matcher?: string;
  readonly hooks: readonly HookEntry[];
}
export interface NestedHookSettings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

/** Whether our hook is installed under the spec's event. */
export function hasNestedHook(settings: NestedHookSettings, spec: NestedHookSpec): boolean {
  const groups = settings.hooks?.[spec.event] ?? [];
  return groups.some((group) => group.hooks.some((entry) => entry.command.includes(spec.marker)));
}

/** Return settings with our hook added under the spec's event (no-op if already present). */
export function addNestedHook(
  settings: NestedHookSettings,
  spec: NestedHookSpec,
  command: string,
): NestedHookSettings {
  if (hasNestedHook(settings, spec)) return settings;
  const group: HookGroup = { matcher: spec.matcher, hooks: [{ type: 'command', command }] };
  const existing = settings.hooks?.[spec.event] ?? [];
  return { ...settings, hooks: { ...settings.hooks, [spec.event]: [...existing, group] } };
}

/** Return settings with our hook removed, pruning any group / event / hooks object left empty. */
export function removeNestedHook(
  settings: NestedHookSettings,
  spec: NestedHookSpec,
): NestedHookSettings {
  const groups = settings.hooks?.[spec.event];
  if (!groups) return settings;
  const pruned = groups
    .map((group) => ({ ...group, hooks: group.hooks.filter((e) => !e.command.includes(spec.marker)) }))
    .filter((group) => group.hooks.length > 0);
  const hooks: Record<string, HookGroup[]> = { ...settings.hooks };
  if (pruned.length > 0) hooks[spec.event] = pruned;
  else delete hooks[spec.event];
  const next: NestedHookSettings = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  return next;
}
