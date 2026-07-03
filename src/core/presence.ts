// Pure presence derivation: maps external write bursts to an "is editing…" / idle state
// for the status bar. Author-agnostic (Claude, vim, sed…). Holds no timers — the adapter
// records writes and re-queries; this only decides from the recorded timestamps.
//
// Reuses the Phase A burst helper rather than reimplementing burst timing: `recordWrite`
// advances the state and `isBursting` (already designed to drive this badge) answers
// "still editing?". The linger is just a longer quiet window than burst grouping, so a
// brief pause between rapid external writes doesn't flicker the badge to idle.

import type { Author } from './attribution.js';
import { NO_BURST, recordWrite, isBursting, type BurstState } from './write-burst.js';

export interface PresenceState {
  readonly burst: BurstState;
  /** Author of the most recent external write, or null before any write. */
  readonly author: Author | null;
}

export const NO_PRESENCE: PresenceState = { burst: NO_BURST, author: null };

/** Whether an external author is actively editing, and who. */
export type Presence =
  | { readonly status: 'idle' }
  | { readonly status: 'editing'; readonly author: Author };

const IDLE: Presence = { status: 'idle' };

/** Record an external write by `author` at `now`; `lingerMs` groups it with recent writes. */
export function recordExternalWrite(
  state: PresenceState,
  author: Author,
  now: number,
  lingerMs: number,
): PresenceState {
  return { burst: recordWrite(state.burst, now, lingerMs), author };
}

/** Presence at `now`: 'editing' while a write landed within `lingerMs`, else 'idle'. */
export function presenceAt(state: PresenceState, now: number, lingerMs: number): Presence {
  if (state.author !== null && isBursting(state.burst, now, lingerMs)) {
    return { status: 'editing', author: state.author };
  }
  return IDLE;
}
