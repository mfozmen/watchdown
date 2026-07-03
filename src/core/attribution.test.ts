import { describe, expect, it } from 'vitest';
import { attributeExternalChange, type Author } from './attribution.js';

const claude: Author = { id: 'claude', label: 'Claude' };
const human: Author = { id: 'human' };

describe('attributeExternalChange', () => {
  it('attributes added lines to the author', () => {
    const r = attributeExternalChange('a\nc', 'a\nb\nc', claude);

    expect(r.hasChanges).toBe(true);
    expect(r.ranges).toEqual([{ kind: 'added', start: 1, end: 2, removedCount: 0, author: claude }]);
  });

  it('attributes modified lines to the author', () => {
    const r = attributeExternalChange('a\nb\nc', 'a\nB\nc', claude);

    expect(r.ranges).toEqual([{ kind: 'modified', start: 1, end: 2, removedCount: 0, author: claude }]);
  });

  it('does not attribute unchanged content', () => {
    const r = attributeExternalChange('a\nb\nc', 'a\nb\nc', claude);

    expect(r.hasChanges).toBe(false);
    expect(r.ranges).toEqual([]);
  });

  it('represents a deletion as a zero-width position with the removed count', () => {
    const r = attributeExternalChange('a\nb\nc', 'a\nc', claude);

    expect(r.ranges).toEqual([{ kind: 'removed', start: 1, end: 1, removedCount: 1, author: claude }]);
  });

  it('attributes multiple disjoint changes each to the author', () => {
    const r = attributeExternalChange('a\nb\nc\nd\ne', 'A\nb\nc\nd\nE', claude);

    expect(r.ranges).toEqual([
      { kind: 'modified', start: 0, end: 1, removedCount: 0, author: claude },
      { kind: 'modified', start: 4, end: 5, removedCount: 0, author: claude },
    ]);
  });

  it('attributes an empty-to-content change (new file) as added', () => {
    const r = attributeExternalChange('', 'a\nb', claude);

    expect(r.ranges).toEqual([{ kind: 'added', start: 0, end: 2, removedCount: 0, author: claude }]);
  });

  it('attributes clearing a file as a removal at the start', () => {
    const r = attributeExternalChange('a\nb', '', claude);

    expect(r.ranges).toEqual([{ kind: 'removed', start: 0, end: 0, removedCount: 2, author: claude }]);
  });

  it('re-attributes a line on a successive change without double-counting', () => {
    const first = attributeExternalChange('a\nb\nc', 'a\nB1\nc', human);
    expect(first.ranges).toEqual([{ kind: 'modified', start: 1, end: 2, removedCount: 0, author: human }]);

    // The second change diffs against the prior content, so the line is re-attributed to the
    // new author only — no accumulation of the earlier authorship.
    const second = attributeExternalChange('a\nB1\nc', 'a\nB2\nc', claude);
    expect(second.ranges).toEqual([{ kind: 'modified', start: 1, end: 2, removedCount: 0, author: claude }]);
  });
});
