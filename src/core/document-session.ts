/**
 * Pure sync-engine core: the document session state model.
 *
 * A DocumentSession tracks whether in-memory content matches what is known to be
 * on disk ("clean") or has diverged due to unsaved edits ("dirty"). It has zero
 * Electron, DOM, or filesystem dependencies — disk changes are handed to it as
 * plain strings by an adapter layer.
 *
 */

import { threeWayMerge, type ThreeWayMergeResult } from './three-way-merge.js';

/** The three mutually-exclusive reconciliation states. */
export type SessionStatus = 'clean' | 'dirty' | 'conflict';

/** Reconstruct merged document text from a conflict-free merge result (conflict segments are skipped). */
const stableText = (result: ThreeWayMergeResult): string =>
  result.segments.flatMap((s) => ('stable' in s ? s.stable : [])).join('\n');

/** Conflict snapshot captured at detection; base and theirs feed resolution. */
export interface ConflictState {
  readonly base: string;
  /** Buffer at detection time; resolveConflict() merges the live buffer instead, so this can be stale. */
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

  /** Resolve the active conflict via 3-way merge using the live buffer as ours; returns the structured result. */
  resolveConflict(): ThreeWayMergeResult;
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
        // Buffer already matches disk: adopt the new content and drop any conflict.
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
      // Dirty and divergent: preserve both sides; base stays anchored at the pre-conflict disk.
      conflict = { base: lastKnownDisk, ours: buffer, theirs: diskContent };
    },

    resolveConflict(): ThreeWayMergeResult {
      if (!conflict) throw new Error('resolveConflict() called with no active conflict');
      // ours is read live from the current buffer — edits made after detection count.
      const result = threeWayMerge(conflict.base, buffer, conflict.theirs);
      // Overlaps remain: stay in conflict and expose the segments for a UI to render.
      if (result.hasConflict) return result;
      // Clean auto-merge: adopt the merged text, advance disk to theirs, clear the conflict.
      buffer = stableText(result);
      lastKnownDisk = conflict.theirs;
      conflict = null;
      return result;
    },
  };
}
