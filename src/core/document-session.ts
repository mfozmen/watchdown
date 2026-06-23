/**
 * Pure sync-engine core: the document session state model.
 *
 * A DocumentSession tracks whether in-memory content matches what is known to be
 * on disk ("clean") or has diverged due to unsaved edits ("dirty"). It has zero
 * Electron, DOM, or filesystem dependencies — disk changes are handed to it as
 * plain strings by an adapter layer.
 *
 */

/** The three mutually-exclusive reconciliation states. */
export type SessionStatus = 'clean' | 'dirty' | 'conflict';

/** The base/ours/theirs triple a 3-way merge will consume to resolve a conflict. */
export interface ConflictState {
  readonly base: string;
  readonly ours: string;
  readonly theirs: string;
}

export interface DocumentSession {
  /** The current in-memory content of the document. */
  readonly content: string;

  /** Current reconciliation state: clean, dirty, or conflict. */
  readonly status: SessionStatus;

  /** True when in-memory content equals the last-known disk content. */
  readonly isClean: boolean;

  /** True when the buffer differs from last-known disk content (derived, not sticky). */
  readonly isDirty: boolean;

  /** The base/ours/theirs to resolve when status is conflict; otherwise null. */
  readonly conflict: ConflictState | null;

  /** Apply an in-memory edit; updates the buffer only, so clean/dirty is re-derived. */
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
  let buffer = content;
  let lastKnownDisk = content;
  let conflict: ConflictState | null = null;

  // Single source of truth for the three mutually-exclusive states.
  const deriveStatus = (): SessionStatus => {
    if (conflict) return 'conflict';
    return buffer === lastKnownDisk ? 'clean' : 'dirty';
  };

  return {
    get content(): string {
      return buffer;
    },

    get status(): SessionStatus {
      return deriveStatus();
    },

    get isClean(): boolean {
      return deriveStatus() === 'clean';
    },

    get isDirty(): boolean {
      return deriveStatus() === 'dirty';
    },

    get conflict(): ConflictState | null {
      return conflict;
    },

    applyLocalEdit(newContent: string): void {
      // Update the buffer only; leaving lastKnownDisk untouched keeps clean/dirty derived.
      buffer = newContent;
    },

    applyExternalChange(diskContent: string): void {
      if (buffer === lastKnownDisk) {
        // Clean: no unsaved edits to protect, so adopt the new disk content (and drop any conflict).
        buffer = diskContent;
        lastKnownDisk = diskContent;
        conflict = null;
        return;
      }
      if (diskContent === buffer) {
        // Both sides converged on the same text: reconcile to clean (and drop any conflict).
        lastKnownDisk = diskContent;
        conflict = null;
        return;
      }
      // Dirty and divergent: never overwrite unsaved work — preserve both sides.
      conflict = { base: lastKnownDisk, ours: buffer, theirs: diskContent };
    },
  };
}
