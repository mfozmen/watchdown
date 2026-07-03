// Pure line-level attribution: given the previous known content and a new external
// content, determine which lines changed and attribute them to an author. This is the
// data layer for the Phase B UI (gutter markers, author icons, tooltips) — no UI here.
// Reuses node-diff3 (the same engine as three-way-merge) for a consistent line diff.

/** Open author identity — any external tool (Claude, vim, VS Code, sed…), not Claude-specific. */
export interface Author {
  /** Stable id, e.g. 'external' / 'claude' / 'human'. Free-form and extensible. */
  readonly id: string;
  /** Optional display label. */
  readonly label?: string;
}

export type AttributionKind = 'added' | 'modified' | 'removed';

export interface AttributedRange {
  readonly kind: AttributionKind;
  /** Half-open [start, end) 0-based line indices in the NEW content. */
  readonly start: number;
  readonly end: number;
  /** Lines deleted (only meaningful for 'removed', where start === end; 0 otherwise). */
  readonly removedCount: number;
  readonly author: Author;
}

export interface AttributionResult {
  readonly ranges: AttributedRange[];
  readonly hasChanges: boolean;
}

/**
 * Attribute the lines changed between `oldContent` and `newContent` to `author`.
 *
 * Attribution is computed **per change against the last-known content**, with no
 * accumulated history (current attribution, not an audit log): a later change to a line
 * simply re-attributes it to the new author. The caller/UI composes current authorship by
 * applying each change's ranges as it arrives.
 */
export function attributeExternalChange(
  _oldContent: string,
  _newContent: string,
  _author: Author,
): AttributionResult {
  throw new Error('attributeExternalChange is not implemented yet');
}
