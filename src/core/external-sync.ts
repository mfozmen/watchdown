// Reduces an external disk change to the one outcome the editor applies: reload or conflict.

import type { DocumentSession } from './document-session.js';
import type { MergeSegment } from './three-way-merge.js';

/** What the editor should do after disk content arrives. */
export type ExternalChangeOutcome =
  /** Adopt this content into the editor (renderer preserves cursor/scroll). */
  | { readonly kind: 'reload'; readonly content: string }
  /** Overlapping edits remain: keep the user's buffer and drive the resolver from `segments`. */
  | { readonly kind: 'conflict'; readonly segments: MergeSegment[] };

/**
 * Feed disk content into the session and decide the reaction: clean → adopt; dirty →
 * 3-way merge; auto-merged → adopt merged; unresolved overlaps → conflict (nothing lost).
 */
export function reconcileExternalChange(
  session: DocumentSession,
  diskContent: string,
): ExternalChangeOutcome {
  session.applyExternalChange(diskContent);
  if (session.status !== 'conflict') {
    return { kind: 'reload', content: session.content };
  }
  const result = session.resolveConflict();
  if (!result.hasConflict) {
    return { kind: 'reload', content: session.content };
  }
  // Overlaps remain: leave the buffer untouched and hand the segments to the resolver.
  return { kind: 'conflict', segments: result.segments };
}
