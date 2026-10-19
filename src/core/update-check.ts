// Pure check of GitHub's "latest release" payload against the running version. The payload
// comes off the network, so it's validated here rather than trusted by the adapter.

export interface AvailableUpdate {
  readonly version: string;
  readonly url: string;
}

function parseVersion(text: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return match ? match.slice(1).map(Number) : null;
}

/** The release in `payload` if it's a newer x.y.z than `current`, else null (also on bad input). */
export function newerRelease(payload: unknown, current: string): AvailableUpdate | null {
  const { tag_name: tag, html_url: url } = (payload ?? {}) as Record<string, unknown>;
  if (typeof tag !== 'string' || typeof url !== 'string' || !/^https:\/\//i.test(url)) return null;
  const latest = parseVersion(tag);
  const running = parseVersion(current);
  if (!latest || !running) return null;
  const diff = latest.map((part, i) => part - (running[i] ?? 0)).find((d) => d !== 0) ?? 0;
  return diff > 0 ? { version: latest.join('.'), url } : null;
}
