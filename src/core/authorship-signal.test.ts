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
  // The hook wraps Claude Code's raw PostToolUse payload with a timestamp and author.
  const record = (over: Record<string, unknown> = {}): string =>
    JSON.stringify({
      ts: 1000,
      author: 'Claude Code',
      payload: { tool_input: { file_path: '/tmp/notes.md' } },
      ...over,
    });

  it('extracts the edited file from the wrapped Claude payload', () => {
    expect(parseSignal(record())).toEqual({ file: '/tmp/notes.md', author: 'Claude Code', ts: 1000 });
  });

  it('returns null for malformed JSON', () => {
    expect(parseSignal('{ not json')).toBeNull();
    expect(parseSignal('')).toBeNull();
  });

  it('returns null for a missing or non-finite timestamp', () => {
    expect(parseSignal(record({ ts: undefined }))).toBeNull();
    expect(parseSignal(record({ ts: 'soon' }))).toBeNull();
    expect(parseSignal(record({ ts: Infinity }))).toBeNull();
  });

  it('returns null for a missing or blank author', () => {
    expect(parseSignal(record({ author: undefined }))).toBeNull();
    expect(parseSignal(record({ author: ' ' }))).toBeNull();
  });

  it('returns null when the payload lacks a usable file path', () => {
    expect(parseSignal(record({ payload: undefined }))).toBeNull();
    expect(parseSignal(record({ payload: 'nope' }))).toBeNull();
    expect(parseSignal(record({ payload: {} }))).toBeNull();
    expect(parseSignal(record({ payload: { tool_input: {} } }))).toBeNull();
    expect(parseSignal(record({ payload: { tool_input: { file_path: 42 } } }))).toBeNull();
    expect(parseSignal(record({ payload: { tool_input: { file_path: '  ' } } }))).toBeNull();
  });

  it('returns null for a non-object top-level value', () => {
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
