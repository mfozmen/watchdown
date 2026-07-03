// Pure relative-time formatting for attribution tooltips (e.g. "Changed by … · 2s ago").
// Deterministic: takes both timestamps, no clock access.

/** Format `fromMs` relative to `nowMs` as a short string: "just now", "3s ago", "2m ago", "4h ago", "5d ago". */
export function formatRelativeTime(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
