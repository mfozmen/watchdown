import { describe, expect, it } from 'vitest';
import { loadDocument } from './document-session.js';
import { reconcileExternalChange } from './external-sync.js';

describe('reconcileExternalChange', () => {
  it('reloads with the new content when the session is clean', () => {
    const session = loadDocument('a\nb\nc');

    const outcome = reconcileExternalChange(session, 'a\nB\nc');

    expect(outcome).toEqual({ kind: 'reload', content: 'a\nB\nc' });
    expect(session.status).toBe('clean');
  });

  it('auto-merges disjoint edits and reloads with both changes (dirty)', () => {
    const session = loadDocument('a\nb\nc\nd\ne');
    session.applyLocalEdit('A\nb\nc\nd\ne'); // ours edits an early line

    const outcome = reconcileExternalChange(session, 'a\nb\nc\nd\nE'); // theirs edits a later line

    expect(outcome).toEqual({ kind: 'reload', content: 'A\nb\nc\nd\nE' });
    expect(session.status).toBe('dirty');
  });

  it('reports a conflict with the merge segments and preserves the buffer when edits overlap', () => {
    const session = loadDocument('a\nb\nc');
    session.applyLocalEdit('a\nOURS\nc');

    const outcome = reconcileExternalChange(session, 'a\nTHEIRS\nc');

    expect(outcome.kind).toBe('conflict');
    if (outcome.kind === 'conflict') {
      const seg = outcome.segments.find((s) => 'conflict' in s);
      expect(seg).toEqual({ conflict: { base: ['b'], ours: ['OURS'], theirs: ['THEIRS'] } });
    }
    expect(session.status).toBe('conflict');
    expect(session.content).toBe('a\nOURS\nc');
  });

  it('reloads to clean when the external content matches the unsaved buffer', () => {
    const session = loadDocument('a\nb\nc');
    session.applyLocalEdit('a\nB\nc');

    const outcome = reconcileExternalChange(session, 'a\nB\nc');

    expect(outcome).toEqual({ kind: 'reload', content: 'a\nB\nc' });
    expect(session.status).toBe('clean');
  });
});
