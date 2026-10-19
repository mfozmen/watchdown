// A named wrapper so callers read in Claude terms; the merge logic and its tests live in
// nested-hook.ts.

import {
  addNestedHook,
  hasNestedHook,
  removeNestedHook,
  type NestedHookSettings,
  type NestedHookSpec,
} from './nested-hook.js';

export const HOOK_MATCHER = 'Write|Edit|MultiEdit';
// Identifies our hook within settings regardless of the absolute script path (machine-specific).
export const HOOK_COMMAND_MARKER = 'claude-hook.mjs';

const CLAUDE_HOOK: NestedHookSpec = {
  event: 'PostToolUse',
  matcher: HOOK_MATCHER,
  marker: HOOK_COMMAND_MARKER,
};

export type ClaudeSettings = NestedHookSettings;

/** Whether Watchdown's hook is already installed in these Claude settings. */
export const hasClaudeHook = (settings: ClaudeSettings): boolean =>
  hasNestedHook(settings, CLAUDE_HOOK);

/** Return settings with our PostToolUse hook added (no-op if already present). */
export const addClaudeHook = (settings: ClaudeSettings, command: string): ClaudeSettings =>
  addNestedHook(settings, CLAUDE_HOOK, command);

/** Return settings with our hook removed, pruning anything it leaves empty. */
export const removeClaudeHook = (settings: ClaudeSettings): ClaudeSettings =>
  removeNestedHook(settings, CLAUDE_HOOK);
