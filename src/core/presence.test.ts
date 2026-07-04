import { describe, expect, it } from 'vitest';
import { NO_PRESENCE, recordExternalWrite, presenceAt } from './presence.js';

const claude = { id: 'claude', label: 'Claude' };
const other = { id: 'external', label: 'an external tool' };
const LINGER = 500;

describe('presence', () => {
  it('is idle before any external write', () => {
    expect(presenceAt(NO_PRESENCE, 1000, LINGER)).toEqual({ status: 'idle' });
  });

  it('is editing (with the author) right after a write', () => {
    const s = recordExternalWrite(NO_PRESENCE, claude, 1000, LINGER);

    expect(presenceAt(s, 1000, LINGER)).toEqual({ status: 'editing', author: claude });
  });

  it('stays editing across a brief gap shorter than the linger', () => {
    const s = recordExternalWrite(NO_PRESENCE, claude, 1000, LINGER);

    // 400ms after the write, still within the linger — no flicker to idle.
    expect(presenceAt(s, 1400, LINGER)).toEqual({ status: 'editing', author: claude });
  });

  it('goes idle after sustained silence past the linger', () => {
    const s = recordExternalWrite(NO_PRESENCE, claude, 1000, LINGER);

    expect(presenceAt(s, 1600, LINGER)).toEqual({ status: 'idle' }); // 600ms > 500ms
  });

  it('a second write within the linger keeps the session alive from the newer write', () => {
    let s = recordExternalWrite(NO_PRESENCE, claude, 1000, LINGER);
    s = recordExternalWrite(s, claude, 1300, LINGER); // 300ms gap — same session

    // 400ms after the *newer* write (1700) is still editing, even though 700ms elapsed
    // since the first write — the linger tracks the most recent write, not the first.
    expect(presenceAt(s, 1700, LINGER)).toEqual({ status: 'editing', author: claude });
  });

  it('resumes editing when a new write arrives after going idle', () => {
    let s = recordExternalWrite(NO_PRESENCE, claude, 1000, LINGER);
    expect(presenceAt(s, 2000, LINGER)).toEqual({ status: 'idle' }); // went idle
    s = recordExternalWrite(s, claude, 3000, LINGER);

    expect(presenceAt(s, 3000, LINGER)).toEqual({ status: 'editing', author: claude });
  });

  it('shows the most recent author when a different tool writes', () => {
    let s = recordExternalWrite(NO_PRESENCE, claude, 1000, LINGER);
    s = recordExternalWrite(s, other, 1200, LINGER);

    expect(presenceAt(s, 1200, LINGER)).toEqual({ status: 'editing', author: other });
  });
});
