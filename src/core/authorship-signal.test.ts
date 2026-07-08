import { describe, expect, it } from 'vitest';
import { attributedAuthor, canonicalizePath, parseSignal } from './authorship-signal.js';

describe('canonicalizePath', () => {
  it('lowercases on Windows, where paths are case-insensitive', () => {
    expect(canonicalizePath('C:\\Users\\Foo\\Notes.md', 'win32')).toBe('c:\\users\\foo\\notes.md');
  });

  it('leaves the path unchanged on case-sensitive platforms', () => {
    expect(canonicalizePath('/Proj/Notes.md', 'linux')).toBe('/Proj/Notes.md');
    expect(canonicalizePath('/Proj/Notes.md', 'darwin')).toBe('/Proj/Notes.md');
  });
});

describe('parseSignal', () => {
  it('parses a well-formed signal record', () => {
    const raw = JSON.stringify({ file: '/tmp/notes.md', author: 'Claude Code', ts: 1000 });
    expect(parseSignal(raw)).toEqual({ file: '/tmp/notes.md', author: 'Claude Code', ts: 1000 });
  });

  it('returns null for malformed JSON', () => {
    expect(parseSignal('{ not json')).toBeNull();
    expect(parseSignal('')).toBeNull();
  });

  it('returns null when a field is missing or the wrong type', () => {
    expect(parseSignal(JSON.stringify({ author: 'x', ts: 1 }))).toBeNull();
    expect(parseSignal(JSON.stringify({ file: '/a', ts: 1 }))).toBeNull();
    expect(parseSignal(JSON.stringify({ file: '/a', author: 'x' }))).toBeNull();
    expect(parseSignal(JSON.stringify({ file: 1, author: 'x', ts: 1 }))).toBeNull();
    expect(parseSignal(JSON.stringify({ file: '/a', author: 'x', ts: 'soon' }))).toBeNull();
  });

  it('returns null for blank file or author, or a non-finite timestamp', () => {
    expect(parseSignal(JSON.stringify({ file: '  ', author: 'x', ts: 1 }))).toBeNull();
    expect(parseSignal(JSON.stringify({ file: '/a', author: ' ', ts: 1 }))).toBeNull();
    expect(parseSignal(JSON.stringify({ file: '/a', author: 'x', ts: Infinity }))).toBeNull();
  });

  it('returns null for a non-object payload', () => {
    expect(parseSignal(JSON.stringify('a string'))).toBeNull();
    expect(parseSignal(JSON.stringify(null))).toBeNull();
    expect(parseSignal(JSON.stringify(42))).toBeNull();
  });
});

describe('attributedAuthor', () => {
  const signal = { file: '/tmp/notes.md', author: 'Claude Code', ts: 1000 };

  it('returns the author when the file matches within the time window', () => {
    expect(attributedAuthor(signal, '/tmp/notes.md', 1200, 5000)).toBe('Claude Code');
  });

  it('returns null when the changed file is a different path', () => {
    expect(attributedAuthor(signal, '/tmp/other.md', 1200, 5000)).toBeNull();
  });

  it('returns null for a stale signal outside the window', () => {
    expect(attributedAuthor(signal, '/tmp/notes.md', 9000, 5000)).toBeNull();
  });

  it('tolerates minor clock skew (signal slightly ahead of the observation)', () => {
    expect(attributedAuthor(signal, '/tmp/notes.md', 800, 5000)).toBe('Claude Code');
  });

  it('returns null when there is no signal', () => {
    expect(attributedAuthor(null, '/tmp/notes.md', 1200, 5000)).toBeNull();
  });
});
