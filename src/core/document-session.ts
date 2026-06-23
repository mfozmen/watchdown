/**
 * Pure sync-engine core: the document session state model.
 *
 * A DocumentSession tracks whether in-memory content matches what is known to be
 * on disk ("clean") or has diverged due to unsaved edits ("dirty"). It has zero
 * Electron, DOM, or filesystem dependencies — disk changes are handed to it as
 * plain strings by an adapter layer.
 *
 * Implementation intentionally left unwritten (TDD: red first).
 */

export interface DocumentSession {
  /** The current in-memory content of the document. */
  readonly content: string;

  /** True when in-memory content equals the last-known disk content. */
  readonly isClean: boolean;

  /**
   * Called when the file changes on disk externally. The session decides how to
   * reconcile the incoming disk content with its in-memory state.
   */
  applyExternalChange(diskContent: string): void;
}

/**
 * Create a document session from freshly-loaded disk content. The loaded content
 * is, by definition, in sync with disk — so the session starts clean.
 */
export function loadDocument(_content: string): DocumentSession {
  throw new Error('loadDocument is not implemented yet');
}
