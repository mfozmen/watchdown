import { describe, expect, it } from 'vitest';
import { loadDocument } from './document-session.js';
import type { ConflictSegment } from './three-way-merge.js';

describe('DocumentSession', () => {
  it('is clean immediately after loading', () => {
    const session = loadDocument('# Hello\n');

    expect(session.content).toBe('# Hello\n');
    expect(session.isClean).toBe(true);
  });

  it('silently adopts an external disk change while clean and stays clean', () => {
    const session = loadDocument('# Hello\n');

    session.applyExternalChange('# Hello, world\n');

    expect(session.content).toBe('# Hello, world\n');
    expect(session.isClean).toBe(true);
  });

  it('becomes dirty when a local edit makes the buffer differ from disk', () => {
    const session = loadDocument('# Hello\n');
    expect(session.isDirty).toBe(false);

    session.applyLocalEdit('# Hello, world\n');

    expect(session.content).toBe('# Hello, world\n');
    expect(session.isDirty).toBe(true);
    expect(session.isClean).toBe(false);
  });

  it('returns to clean when a local edit restores the last-known disk content', () => {
    const session = loadDocument('# Hello\n');
    session.applyLocalEdit('# Hello, world\n');
    expect(session.isDirty).toBe(true);

    session.applyLocalEdit('# Hello\n');

    expect(session.isDirty).toBe(false);
    expect(session.isClean).toBe(true);
  });

  it('keeps silently adopting an external change while clean (no conflict)', () => {
    const session = loadDocument('# Hello\n');

    session.applyExternalChange('# Hello, world\n');

    expect(session.status).toBe('clean');
    expect(session.content).toBe('# Hello, world\n');
    expect(session.conflict).toBeNull();
  });

  it('enters conflict when an external change arrives during unsaved edits', () => {
    const session = loadDocument('# Hello\n');
    session.applyLocalEdit('# Hello, mine\n');

    session.applyExternalChange('# Hello, theirs\n');

    expect(session.status).toBe('conflict');
    expect(session.isClean).toBe(false);
    expect(session.isDirty).toBe(false);
    // Both sides preserved: our buffer intact and theirs retained distinctly.
    expect(session.content).toBe('# Hello, mine\n');
    expect(session.conflict?.theirs).toBe('# Hello, theirs\n');
  });

  it('exposes base, ours and theirs while in conflict', () => {
    const session = loadDocument('# base\n');
    session.applyLocalEdit('# ours\n');

    session.applyExternalChange('# theirs\n');

    expect(session.status).toBe('conflict');
    expect(session.conflict).toEqual({
      base: '# base\n',
      ours: '# ours\n',
      theirs: '# theirs\n',
    });
  });

  it('reconciles to clean when an external change matches the unsaved buffer', () => {
    const session = loadDocument('# Hello\n');
    session.applyLocalEdit('# Hello, world\n');

    session.applyExternalChange('# Hello, world\n');

    expect(session.status).toBe('clean');
    expect(session.conflict).toBeNull();
    expect(session.isClean).toBe(true);
  });

  it('clears an existing conflict when a later external change matches the buffer', () => {
    const session = loadDocument('# base\n');
    session.applyLocalEdit('# ours\n');
    session.applyExternalChange('# theirs\n');
    expect(session.status).toBe('conflict');

    session.applyExternalChange('# ours\n');

    expect(session.status).toBe('clean');
    expect(session.conflict).toBeNull();
  });

  it('marks the session clean after saving the current buffer', () => {
    const session = loadDocument('a');
    session.applyLocalEdit('b');

    session.markSaved('b');

    expect(session.status).toBe('clean');
    expect(session.content).toBe('b');
  });

  it('stays dirty, not conflict, when the buffer moved past the saved content', () => {
    const session = loadDocument('a');
    session.applyLocalEdit('c'); // buffer raced ahead while we persisted an older snapshot

    session.markSaved('b'); // we wrote 'b' to disk; buffer is now 'c'

    expect(session.status).toBe('dirty');
    expect(session.content).toBe('c');
  });

  it('derives dirty when the buffer changes after a save', () => {
    const session = loadDocument('a');
    session.applyLocalEdit('b');
    session.markSaved('b');

    session.applyLocalEdit('c');

    expect(session.status).toBe('dirty');
  });

  it('does not clear an active conflict when markSaved races in during it', () => {
    const session = loadDocument('a\nb\nc');
    session.applyLocalEdit('a\nOURS\nc');
    session.applyExternalChange('a\nTHEIRS\nc');
    expect(session.status).toBe('conflict');

    session.markSaved('a\nOURS\nc'); // a save landing mid-conflict must not drop theirs

    expect(session.status).toBe('conflict');
    expect(session.conflict).not.toBeNull();
  });

  it('clears an existing conflict when the buffer is reverted and a new external change is adopted', () => {
    const session = loadDocument('# base\n');
    session.applyLocalEdit('# ours\n');
    session.applyExternalChange('# theirs\n');
    expect(session.status).toBe('conflict');

    session.applyLocalEdit('# base\n');
    session.applyExternalChange('# fresh\n');

    expect(session.status).toBe('clean');
    expect(session.content).toBe('# fresh\n');
    expect(session.conflict).toBeNull();
  });

  it('auto-merges disjoint changes on resolve, clearing the conflict', () => {
    const session = loadDocument('a\nb\nc\nd\ne');
    session.applyLocalEdit('A\nb\nc\nd\ne'); // ours edits an early region
    session.applyExternalChange('a\nb\nc\nd\nE'); // theirs edits a disjoint later region
    expect(session.status).toBe('conflict');

    const result = session.resolveConflict();

    expect(result.hasConflict).toBe(false);
    expect(session.content).toBe('A\nb\nc\nd\nE'); // both changes present
    expect(session.conflict).toBeNull();
    expect(session.status).toBe('dirty');
    // last-known disk advanced to theirs: editing the buffer back to theirs is clean
    session.applyLocalEdit('a\nb\nc\nd\nE');
    expect(session.isClean).toBe(true);
  });

  it('uses the live buffer as ours when resolving, not the detection snapshot', () => {
    const session = loadDocument('a\nb\nc\nd\ne');
    session.applyLocalEdit('A\nb\nc\nd\ne');
    session.applyExternalChange('a\nb\nc\nd\nE');
    expect(session.conflict?.ours).toBe('A\nb\nc\nd\ne'); // frozen snapshot

    session.applyLocalEdit('A2\nb\nc\nd\ne'); // keep editing after the conflict arose
    const result = session.resolveConflict();

    expect(result.hasConflict).toBe(false);
    expect(session.content).toBe('A2\nb\nc\nd\nE'); // merged from the LATEST buffer, not 'A'
  });

  it('stays in conflict and exposes structured segments when overlaps remain', () => {
    const session = loadDocument('a\nb\nc');
    session.applyLocalEdit('a\nOURS\nc');
    session.applyExternalChange('a\nTHEIRS\nc');

    const result = session.resolveConflict();

    expect(result.hasConflict).toBe(true);
    const seg = result.segments.find((s): s is ConflictSegment => 'conflict' in s);
    expect(seg?.conflict).toEqual({ base: ['b'], ours: ['OURS'], theirs: ['THEIRS'] });
    // nothing dropped: session remains in conflict with the buffer intact
    expect(session.status).toBe('conflict');
    expect(session.content).toBe('a\nOURS\nc');
  });

  it('throws when resolveConflict is called outside a conflict', () => {
    const session = loadDocument('a\nb\nc');

    expect(() => session.resolveConflict()).toThrow(/no active conflict/i);
  });

  it('resolves to clean when the merge result equals theirs', () => {
    const session = loadDocument('a\nb\nc');
    session.applyLocalEdit('a\nOURS\nc');
    session.applyExternalChange('a\nTHEIRS\nc');
    session.applyLocalEdit('a\nb\nc'); // revert our edit while still in conflict

    const result = session.resolveConflict();

    expect(result.hasConflict).toBe(false);
    expect(session.status).toBe('clean');
    expect(session.content).toBe('a\nTHEIRS\nc');
    expect(session.conflict).toBeNull();
  });
});
