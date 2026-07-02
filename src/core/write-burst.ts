// Pure tracker for a run of rapid external writes ("burst"). Holds no timers — the
// adapter records timestamps and schedules; this only decides from those timestamps.
// The same `isBursting` query drives the future "Claude is editing…" presence badge.

export interface BurstState {
  /** Timestamp (ms) of the most recent write, or null if none seen. */
  readonly lastWriteAt: number | null;
  /** Timestamp (ms) when the current burst began, or null if idle. */
  readonly burstStartedAt: number | null;
}

export const NO_BURST: BurstState = { lastWriteAt: null, burstStartedAt: null };

/** Record a write at `now`. A write within `quietWindowMs` of the previous extends the burst; a longer gap begins a new one. */
export function recordWrite(state: BurstState, now: number, quietWindowMs: number): BurstState {
  const continues = isBursting(state, now, quietWindowMs);
  return { lastWriteAt: now, burstStartedAt: continues ? state.burstStartedAt : now };
}

/** True while a burst is ongoing: a write landed within `quietWindowMs` before `now`. */
export function isBursting(state: BurstState, now: number, quietWindowMs: number): boolean {
  return state.lastWriteAt !== null && now - state.lastWriteAt <= quietWindowMs;
}
