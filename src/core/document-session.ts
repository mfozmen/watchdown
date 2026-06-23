/**
 * Pure sync-engine core: the document session state model.
 *
 * A DocumentSession tracks whether in-memory content matches what is known to be
 * on disk ("clean") or has diverged due to unsaved edits ("dirty"). It has zero
 * Electron, DOM, or filesystem dependencies — disk changes are handed to it as
 * plain strings by an adapter layer.
 *
 */

export interface DocumentSession {
  /** The current in-memory content of the document. */
  readonly content: string;

  /** True when in-memory content equals the last-known disk content. */
  readonly isClean: boolean;

  /**
   * True when the buffer has unsaved edits — i.e. it differs from the last-known
   * disk content. Derived by comparison, not a sticky flag: editing the buffer
   * back to the last-known disk content returns the session to clean.
   */
  readonly isDirty: boolean;

  /**
   * Apply an in-memory edit (e.g. the user typing in the editor). Updates the
   * buffer without touching the last-known disk content, so the clean/dirty
   * status is re-derived from the comparison.
   */
  applyLocalEdit(newContent: string): void;

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
export function loadDocument(content: string): DocumentSession {
  // The in-memory buffer and the last-known disk content. The session is clean
  // exactly when they are equal.
  let buffer = content;
  let lastKnownDisk = content;

  return {
    get content(): string {
      return buffer;
    },

    get isClean(): boolean {
      return buffer === lastKnownDisk;
    },

    get isDirty(): boolean {
      throw new Error('isDirty is not implemented yet');
    },

    applyLocalEdit(_newContent: string): void {
      throw new Error('applyLocalEdit is not implemented yet');
    },

    applyExternalChange(diskContent: string): void {
      // Clean session: no local edits to protect, so silently adopt the new
      // disk content and stay in sync.
      buffer = diskContent;
      lastKnownDisk = diskContent;
    },
  };
}
