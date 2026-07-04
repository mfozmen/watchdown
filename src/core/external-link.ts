// Pure allowlist for URLs safe to hand to the OS browser (shell.openExternal). Preview
// links can be written by an untrusted external tool, so only http/https pass through —
// never file:, javascript:, mailto:, etc. Keeps the "is this safe?" decision testable,
// leaving the main process to just open or deny.

/** True only for absolute http/https URLs (the schemes safe to open externally). */
export function isSafeExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}
