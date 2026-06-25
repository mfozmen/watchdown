import { describe, expect, it } from 'vitest';
import { NO_BURST, recordWrite, isBursting } from './write-burst.js';

describe('write-burst', () => {
  it('starts a burst on the first write', () => {
    const s = recordWrite(NO_BURST, 1000, 300);

    expect(s.lastWriteAt).toBe(1000);
    expect(s.burstStartedAt).toBe(1000);
  });

  it('extends the same burst for a write within the quiet window', () => {
    const s = recordWrite(recordWrite(NO_BURST, 1000, 300), 1200, 300); // 200ms gap

    expect(s.burstStartedAt).toBe(1000);
    expect(s.lastWriteAt).toBe(1200);
  });

  it('begins a new burst for a write after the quiet window', () => {
    const s = recordWrite(recordWrite(NO_BURST, 1000, 300), 1500, 300); // 500ms gap

    expect(s.burstStartedAt).toBe(1500);
    expect(s.lastWriteAt).toBe(1500);
  });

  it('is bursting within the quiet window after the last write', () => {
    const s = recordWrite(NO_BURST, 1000, 300);

    expect(isBursting(s, 1200, 300)).toBe(true);
  });

  it('is not bursting once the quiet window has elapsed', () => {
    const s = recordWrite(NO_BURST, 1000, 300);

    expect(isBursting(s, 1400, 300)).toBe(false); // 400ms > 300ms
  });

  it('is not bursting before any write', () => {
    expect(isBursting(NO_BURST, 1000, 300)).toBe(false);
  });
});
