import { describe, expect, it } from 'vitest';
import { NO_ECHO, recordSave, classifyDiskChange } from './save-echo.js';

describe('save-echo', () => {
  it('suppresses the first read that matches our own save', () => {
    const decision = classifyDiskChange(recordSave('saved'), 'saved');

    expect(decision.suppress).toBe(true);
  });

  it('consumes the marker after one read so a later identical write is delivered', () => {
    const first = classifyDiskChange(recordSave('saved'), 'saved');
    const second = classifyDiskChange(first.next, 'saved'); // an external write of the same text later

    expect(first.suppress).toBe(true);
    expect(second.suppress).toBe(false);
  });

  it('delivers, and consumes the marker for, a real external change right after a save', () => {
    const decision = classifyDiskChange(recordSave('saved'), 'external'); // different content in the same burst

    expect(decision.suppress).toBe(false);
    // marker consumed: a subsequent write equal to the saved text is no longer suppressed
    expect(classifyDiskChange(decision.next, 'saved').suppress).toBe(false);
  });

  it('never suppresses when no save is pending', () => {
    expect(classifyDiskChange(NO_ECHO, 'anything').suppress).toBe(false);
  });
});
