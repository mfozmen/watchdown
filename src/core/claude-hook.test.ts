import { describe, expect, it } from 'vitest';
import {
  addClaudeHook,
  hasClaudeHook,
  HOOK_COMMAND_MARKER,
  HOOK_MATCHER,
  removeClaudeHook,
} from './claude-hook.js';

const CMD = 'node "/home/u/.watchdown/claude-hook.mjs"';
const userGroup = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] };

describe('hasClaudeHook', () => {
  it('is false for empty settings and for unrelated hooks', () => {
    expect(hasClaudeHook({})).toBe(false);
    expect(hasClaudeHook({ hooks: { PostToolUse: [userGroup] } })).toBe(false);
  });

  it('is true once our hook is present', () => {
    expect(hasClaudeHook(addClaudeHook({}, CMD))).toBe(true);
  });
});

describe('addClaudeHook', () => {
  it('creates the PostToolUse group with our matcher and command', () => {
    const next = addClaudeHook({}, CMD);
    expect(next.hooks?.PostToolUse).toEqual([
      { matcher: HOOK_MATCHER, hooks: [{ type: 'command', command: CMD }] },
    ]);
    expect(CMD).toContain(HOOK_COMMAND_MARKER);
  });

  it('appends to existing PostToolUse groups without dropping them', () => {
    const next = addClaudeHook({ hooks: { PostToolUse: [userGroup] } }, CMD);
    expect(next.hooks?.PostToolUse).toHaveLength(2);
    expect(next.hooks?.PostToolUse?.[0]).toEqual(userGroup);
  });

  it('preserves unrelated settings keys', () => {
    const next = addClaudeHook({ model: 'opus', hooks: { PreToolUse: [userGroup] } }, CMD);
    expect(next['model']).toBe('opus');
    expect(next.hooks?.PreToolUse).toEqual([userGroup]);
  });

  it('is idempotent — adding twice leaves a single hook', () => {
    const once = addClaudeHook({}, CMD);
    const twice = addClaudeHook(once, CMD);
    expect(twice.hooks?.PostToolUse).toHaveLength(1);
  });

  it('does not mutate the input settings', () => {
    const input = {};
    addClaudeHook(input, CMD);
    expect(input).toEqual({});
  });
});

describe('removeClaudeHook', () => {
  it('removes our hook and prunes the emptied group and hooks object', () => {
    const next = removeClaudeHook(addClaudeHook({}, CMD));
    expect(next).toEqual({});
  });

  it('keeps a shared group but drops only our entry', () => {
    const shared = {
      matcher: HOOK_MATCHER,
      hooks: [
        { type: 'command', command: 'user-thing' },
        { type: 'command', command: CMD },
      ],
    };
    const next = removeClaudeHook({ hooks: { PostToolUse: [shared] } });
    expect(next.hooks?.PostToolUse).toEqual([
      { matcher: HOOK_MATCHER, hooks: [{ type: 'command', command: 'user-thing' }] },
    ]);
  });

  it('preserves other hook events and settings keys', () => {
    const settings = {
      model: 'opus',
      hooks: { PostToolUse: [userGroup], PreToolUse: [userGroup] },
    };
    const withHook = addClaudeHook(settings, CMD);
    const next = removeClaudeHook(withHook);
    expect(next['model']).toBe('opus');
    expect(next.hooks?.PreToolUse).toEqual([userGroup]);
    expect(next.hooks?.PostToolUse).toEqual([userGroup]);
  });

  it('is a no-op when our hook is absent', () => {
    const settings = { hooks: { PostToolUse: [userGroup] } };
    expect(removeClaudeHook(settings)).toEqual(settings);
  });

  it('does not mutate the input settings', () => {
    const input = addClaudeHook({}, CMD);
    const snapshot = JSON.parse(JSON.stringify(input));
    removeClaudeHook(input);
    expect(input).toEqual(snapshot);
  });
});
