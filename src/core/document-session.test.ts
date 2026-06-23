import { describe, expect, it } from 'vitest';
import { loadDocument } from './document-session.js';

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
});
