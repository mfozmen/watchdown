// Ratio-based because the panes differ in height: it keeps them roughly in step without
// aligning individual lines.

/** Fraction [0, 1] of the way scrolled; 0 when there's nothing to scroll. */
export function scrollRatio(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / scrollable));
}

/** The scrollTop that places a pane at `ratio` of its scrollable range. */
export function scrollTopForRatio(ratio: number, scrollHeight: number, clientHeight: number): number {
  return Math.max(0, ratio * (scrollHeight - clientHeight));
}
