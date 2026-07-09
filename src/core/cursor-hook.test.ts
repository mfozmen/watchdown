import { describe, expect, it } from 'vitest';
import {
  addCursorHook,
  CURSOR_HOOK_COMMAND_MARKER,
  hasCursorHook,
  removeCursorHook,
} from './cursor-hook.js';

const CMD = 'node "/home/u/.watchdown/cursor-hook.mjs"';
const userEntry = { command: './.cursor/hooks/format.sh', timeout: 30 };

describe('hasCursorHook', () => {
  it('is false for empty settings and for unrelated hooks', () => {
    expect(hasCursorHook({})).toBe(false);
    expect(hasCursorHook({ version: 1, hooks: { afterFileEdit: [userEntry] } })).toBe(false);
  });

  it('is true once our hook is present', () => {
    expect(hasCursorHook(addCursorHook({}, CMD))).toBe(true);
  });
});

describe('addCursorHook', () => {
  it('creates version 1 and the afterFileEdit entry with our command', () => {
    const next = addCursorHook({}, CMD);
    expect(next.version).toBe(1);
    expect(next.hooks?.afterFileEdit).toEqual([{ command: CMD }]);
    expect(CMD).toContain(CURSOR_HOOK_COMMAND_MARKER);
  });

  it('appends to existing afterFileEdit entries and preserves an existing version', () => {
    const next = addCursorHook({ version: 1, hooks: { afterFileEdit: [userEntry] } }, CMD);
    expect(next.hooks?.afterFileEdit).toHaveLength(2);
    expect(next.hooks?.afterFileEdit?.[0]).toEqual(userEntry);
  });

  it('preserves unrelated settings keys and other hook events', () => {
    const next = addCursorHook({ telemetry: false, hooks: { beforeSubmitPrompt: [userEntry] } }, CMD);
    expect(next['telemetry']).toBe(false);
    expect(next.hooks?.beforeSubmitPrompt).toEqual([userEntry]);
  });

  it('is idempotent — adding twice leaves a single hook', () => {
    const twice = addCursorHook(addCursorHook({}, CMD), CMD);
    expect(twice.hooks?.afterFileEdit).toHaveLength(1);
  });

  it('does not mutate the input settings', () => {
    const input = {};
    addCursorHook(input, CMD);
    expect(input).toEqual({});
  });
});

describe('removeCursorHook', () => {
  it('removes our hook and prunes the emptied array (version, a valid field, stays)', () => {
    const next = removeCursorHook(addCursorHook({}, CMD));
    expect(next).toEqual({ version: 1 });
  });

  it('keeps a shared array but drops only our entry', () => {
    const settings = {
      version: 1,
      hooks: { afterFileEdit: [userEntry, { command: CMD }] },
    };
    const next = removeCursorHook(settings);
    expect(next.hooks?.afterFileEdit).toEqual([userEntry]);
  });

  it('preserves other hook events and settings keys', () => {
    const withHook = addCursorHook({ telemetry: false, hooks: { beforeSubmitPrompt: [userEntry] } }, CMD);
    const next = removeCursorHook(withHook);
    expect(next['telemetry']).toBe(false);
    expect(next.hooks?.beforeSubmitPrompt).toEqual([userEntry]);
    expect(next.hooks?.afterFileEdit).toBeUndefined();
  });

  it('is a no-op when our hook is absent', () => {
    const settings = { version: 1, hooks: { afterFileEdit: [userEntry] } };
    expect(removeCursorHook(settings)).toEqual(settings);
  });

  it('does not mutate the input settings', () => {
    const input = addCursorHook({}, CMD);
    const snapshot = JSON.parse(JSON.stringify(input));
    removeCursorHook(input);
    expect(input).toEqual(snapshot);
  });
});
