import { describe, expect, it } from 'vitest';
import { actionForWatchEvent } from './watch-event.js';

describe('watch-event', () => {
  it('reloads on a change event', () => {
    expect(actionForWatchEvent('change')).toBe('reload');
  });

  it('reloads on an add event (atomic rewrite reappears)', () => {
    expect(actionForWatchEvent('add')).toBe('reload');
  });

  it('awaits a rewrite on an unlink event, not clobbering the buffer', () => {
    expect(actionForWatchEvent('unlink')).toBe('await-rewrite');
  });
});
