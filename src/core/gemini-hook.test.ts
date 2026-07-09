import { describe, expect, it } from 'vitest';
import {
  addGeminiHook,
  GEMINI_HOOK_COMMAND_MARKER,
  hasGeminiHook,
  removeGeminiHook,
} from './gemini-hook.js';

const CMD = 'node "/home/u/.watchdown/gemini-hook.mjs"';

describe('gemini-hook', () => {
  it('installs an AfterTool hook matching the write_file/replace tools', () => {
    const next = addGeminiHook({}, CMD);
    expect(next.hooks?.['AfterTool']).toEqual([
      { matcher: 'write_file|replace', hooks: [{ type: 'command', command: CMD }] },
    ]);
    expect(CMD).toContain(GEMINI_HOOK_COMMAND_MARKER);
  });

  it('detects and removes its own hook round-trip', () => {
    const connected = addGeminiHook({}, CMD);
    expect(hasGeminiHook(connected)).toBe(true);
    expect(removeGeminiHook(connected)).toEqual({});
    expect(hasGeminiHook({})).toBe(false);
  });

  it('ignores a Claude PostToolUse hook — scoped to the AfterTool event', () => {
    const claudeish = {
      hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'node claude-hook.mjs' }] }] },
    };
    expect(hasGeminiHook(claudeish)).toBe(false);
    expect(removeGeminiHook(claudeish)).toEqual(claudeish);
  });
});
