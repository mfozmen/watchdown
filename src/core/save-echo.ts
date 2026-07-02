// Pure decision logic for suppressing the watcher echo of our own save. The Electron main
// process holds the state and does the fs/timer work; this only decides, from the last
// saved content and a freshly-read disk change, whether it's our echo or a real change.

export interface EchoState {
  /** Content we last wrote and expect to see echoed back once, or null when none pending. */
  readonly lastSaved: string | null;
}

export const NO_ECHO: EchoState = { lastSaved: null };

export interface EchoDecision {
  /** True when the read matches our own pending save and should be swallowed. */
  readonly suppress: boolean;
  /** Next state; the marker is one-shot — consumed on the first post-save read. */
  readonly next: EchoState;
}

/** Record that we wrote `content`, so its single watcher echo can be suppressed. */
export function recordSave(content: string): EchoState {
  return { lastSaved: content };
}

/** Decide whether a freshly-read disk change is our own save echo or a genuine external change. */
export function classifyDiskChange(state: EchoState, diskContent: string): EchoDecision {
  // Match or not, the marker is consumed after the first post-save read so a later identical
  // external write is delivered rather than wrongly swallowed.
  return { suppress: diskContent === state.lastSaved, next: NO_ECHO };
}
