import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('renders a heading', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>');
  });

  it('renders bold text and lists', () => {
    const html = renderMarkdown('**bold**\n\n- a\n- b');

    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>a</li>');
  });

  it('renders a fenced code block', () => {
    expect(renderMarkdown('```\ncode\n```')).toContain('<pre><code>');
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  // Security: html:false is the primary XSS guard — literal HTML must be escaped,
  // never passed through. These lock that config so a regression can't re-enable it.
  it('escapes raw HTML instead of passing it through', () => {
    const html = renderMarkdown('<script>alert(1)</script>');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not emit an executable javascript: link', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');

    expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i);
  });
});
