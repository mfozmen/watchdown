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
});
