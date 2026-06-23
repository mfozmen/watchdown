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
});
