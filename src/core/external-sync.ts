// Pure orchestration of an external disk change through the session, yielding the
// single outcome the editor adapter needs. Keeps the renderer trivial: it just applies
// the outcome to CodeMirror (preserving cursor/scroll on reload) and the status bar.

import type { DocumentSession } from './document-session.js';

/** What the editor should do after disk content arrives. */
export type ExternalChangeOutcome =
  /** Adopt this content into the editor (renderer preserves cursor/scroll). */
  | { readonly kind: 'reload'; readonly content: string }
  /** Overlapping edits remain: keep the user's buffer, surface a conflict badge. */
  | { readonly kind: 'conflict' };

/**
 * Feed disk content into the session and decide the reaction: clean → adopt; dirty →
 * 3-way merge; auto-merged → adopt merged; unresolved overlaps → conflict (nothing lost).
 */
export function reconcileExternalChange(
  _session: DocumentSession,
  _diskContent: string,
): ExternalChangeOutcome {
  throw new Error('reconcileExternalChange is not implemented yet');
}
