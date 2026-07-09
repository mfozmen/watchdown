// Gemini CLI's AfterTool hook, over the shared nested-hook merge (see nested-hook.ts). Same
// settings shape as Claude Code — only the event ('AfterTool') and the file-writing tool matcher
// ('write_file' / 'replace') differ.

import {
  addNestedHook,
  hasNestedHook,
  removeNestedHook,
  type NestedHookSettings,
  type NestedHookSpec,
} from './nested-hook.js';

export const GEMINI_HOOK_MATCHER = 'write_file|replace';
export const GEMINI_HOOK_COMMAND_MARKER = 'gemini-hook.mjs';

const GEMINI_HOOK: NestedHookSpec = {
  event: 'AfterTool',
  matcher: GEMINI_HOOK_MATCHER,
  marker: GEMINI_HOOK_COMMAND_MARKER,
};

export type GeminiSettings = NestedHookSettings;

/** Whether Watchdown's hook is already installed in these Gemini CLI settings. */
export const hasGeminiHook = (settings: GeminiSettings): boolean =>
  hasNestedHook(settings, GEMINI_HOOK);

/** Return settings with our AfterTool hook added (no-op if already present). */
export const addGeminiHook = (settings: GeminiSettings, command: string): GeminiSettings =>
  addNestedHook(settings, GEMINI_HOOK, command);

/** Return settings with our hook removed, pruning anything it leaves empty. */
export const removeGeminiHook = (settings: GeminiSettings): GeminiSettings =>
  removeNestedHook(settings, GEMINI_HOOK);
