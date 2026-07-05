import { describe, expect, it } from 'vitest';
import { windowTitle } from './window-title.js';

describe('windowTitle', () => {
  it('is the bare app name when no file is open', () => {
    expect(windowTitle(null, false)).toBe('Watchdown');
    expect(windowTitle('', false)).toBe('Watchdown');
  });

  it('shows the file name (not the full path) plus the app name', () => {
    expect(windowTitle('/home/user/notes.md', false)).toBe('notes.md — Watchdown');
  });

  it('takes the basename from a Windows path too', () => {
    expect(windowTitle('C:\\Users\\me\\notes.md', false)).toBe('notes.md — Watchdown');
  });

  it('prefixes a dot marker when there are unsaved changes', () => {
    expect(windowTitle('/home/user/notes.md', true)).toBe('● notes.md — Watchdown');
  });

  it('handles a bare file name with no directory', () => {
    expect(windowTitle('notes.md', true)).toBe('● notes.md — Watchdown');
  });
});
