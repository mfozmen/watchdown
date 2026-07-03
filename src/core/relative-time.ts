// Pure relative-time formatting for attribution tooltips (e.g. "Changed by … · 2s ago").
// Deterministic: takes both timestamps, no clock access.

/** Format `fromMs` relative to `nowMs` as a short string: "just now", "3s ago", "2m ago", "4h ago", "5d ago". */
export function formatRelativeTime(_fromMs: number, _nowMs: number): string {
  throw new Error('formatRelativeTime is not implemented yet');
}
