import { describe, expect, it } from 'vitest';
import { addNestedHook, hasNestedHook, removeNestedHook, type NestedHookSpec } from './nested-hook.js';

// Claude Code and Gemini CLI share this settings shape: hooks -> <Event> -> [{matcher, hooks:[…]}].
// Only the event name, tool-name matcher, and our command marker differ, so the merge is generic.
const SPEC: NestedHookSpec = { event: 'PostToolUse', matcher: 'Write|Edit', marker: 'wd-hook.mjs' };
const CMD = 'node "/home/u/.watchdown/wd-hook.mjs"';
const userGroup = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] };

describe('hasNestedHook', () => {
  it('is false for empty settings and unrelated hooks', () => {
    expect(hasNestedHook({}, SPEC)).toBe(false);
    expect(hasNestedHook({ hooks: { PostToolUse: [userGroup] } }, SPEC)).toBe(false);
  });

  it('is true once our hook is present', () => {
    expect(hasNestedHook(addNestedHook({}, SPEC, CMD), SPEC)).toBe(true);
  });

  it('is scoped to the spec event — the same hook under another event does not count', () => {
    const underOtherEvent = addNestedHook({}, { ...SPEC, event: 'AfterTool' }, CMD);
    expect(hasNestedHook(underOtherEvent, SPEC)).toBe(false);
  });
});

describe('addNestedHook', () => {
  it('creates the event group with our matcher and command', () => {
    expect(addNestedHook({}, SPEC, CMD).hooks?.['PostToolUse']).toEqual([
      { matcher: 'Write|Edit', hooks: [{ type: 'command', command: CMD }] },
    ]);
  });

  it('appends to existing groups for the same event without dropping them', () => {
    const next = addNestedHook({ hooks: { PostToolUse: [userGroup] } }, SPEC, CMD);
    expect(next.hooks?.['PostToolUse']).toHaveLength(2);
    expect(next.hooks?.['PostToolUse']?.[0]).toEqual(userGroup);
  });

  it('preserves other events and settings keys', () => {
    const next = addNestedHook({ model: 'x', hooks: { AfterTool: [userGroup] } }, SPEC, CMD);
    expect(next['model']).toBe('x');
    expect(next.hooks?.['AfterTool']).toEqual([userGroup]);
  });

  it('is idempotent', () => {
    const once = addNestedHook({}, SPEC, CMD);
    expect(addNestedHook(once, SPEC, CMD).hooks?.['PostToolUse']).toHaveLength(1);
  });

  it('does not mutate the input', () => {
    const input = {};
    addNestedHook(input, SPEC, CMD);
    expect(input).toEqual({});
  });
});

describe('removeNestedHook', () => {
  it('removes our hook and prunes the emptied group and hooks object', () => {
    expect(removeNestedHook(addNestedHook({}, SPEC, CMD), SPEC)).toEqual({});
  });

  it('keeps a shared group but drops only our entry', () => {
    const shared = {
      matcher: 'Write|Edit',
      hooks: [
        { type: 'command', command: 'user-thing' },
        { type: 'command', command: CMD },
      ],
    };
    const next = removeNestedHook({ hooks: { PostToolUse: [shared] } }, SPEC);
    expect(next.hooks?.['PostToolUse']).toEqual([
      { matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'user-thing' }] },
    ]);
  });

  it('preserves other events and settings keys', () => {
    const withHook = addNestedHook({ model: 'x', hooks: { AfterTool: [userGroup] } }, SPEC, CMD);
    const next = removeNestedHook(withHook, SPEC);
    expect(next['model']).toBe('x');
    expect(next.hooks?.['AfterTool']).toEqual([userGroup]);
    expect(next.hooks?.['PostToolUse']).toBeUndefined();
  });

  it('is a no-op when our hook is absent', () => {
    const settings = { hooks: { PostToolUse: [userGroup] } };
    expect(removeNestedHook(settings, SPEC)).toEqual(settings);
  });

  it('does not mutate the input', () => {
    const input = addNestedHook({}, SPEC, CMD);
    const snapshot = JSON.parse(JSON.stringify(input));
    removeNestedHook(input, SPEC);
    expect(input).toEqual(snapshot);
  });
});
