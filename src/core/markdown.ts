// Pure markdown -> HTML rendering for the preview pane. DOM-free (renders to a string),
// so it lives in the tested core rather than the adapter. The renderer still sanitizes
// this output (DOMPurify) before injecting it into the DOM — defense in depth.

import MarkdownIt from 'markdown-it';

// html:false is the primary XSS guard: literal HTML in the source is ESCAPED, never
// passed through, so a document can't inject <script>/<img onerror> etc. linkify turns
// bare URLs into links; markdown-it's own link validation rejects javascript:/vbscript:.
const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

/** Render markdown `source` to an HTML string. Pure and DOM-free. */
export function renderMarkdown(source: string): string {
  return md.render(source);
}
