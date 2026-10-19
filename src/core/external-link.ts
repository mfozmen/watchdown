// Preview links can be written by an untrusted external tool, so only http/https may reach
// shell.openExternal — never file:, javascript:, mailto:.

/** True only for absolute http/https URLs (the schemes safe to open externally). */
export function isSafeExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}
