import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

/**
 * Shared markdown -> safe HTML renderer. Powers the Viewer now and the Editor
 * preview later, so Viewer and Editor can never disagree on output.
 *
 * Pipeline: markdown-it (GFM-ish: tables, strikethrough, task lists, linkify,
 * raw HTML allowed) -> DOMPurify (strips scripts, event handlers,
 * javascript: URLs, frames). markdown-it produces HTML; DOMPurify makes it safe.
 *
 * Requires a DOM. In the browser this is `window`; under test we inject jsdom.
 */

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

// --- GFM constructs not in CommonMark: strikethrough is built in; tables are
//     enabled by default in markdown-it; task lists need a small plugin.
md.enable(['table', 'strikethrough']);

// Minimal task-list support: turn "[ ]"/"[x]" at the start of a list item's
// first paragraph into disabled checkboxes, matching GFM rendering.
md.core.ruler.after('inline', 'portablemd_task_lists', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'inline' || !token.children || token.children.length === 0) {
      continue;
    }
    // Must be the first inline inside a list item paragraph.
    const isListItemParagraph =
      i >= 2 &&
      tokens[i - 1]!.type === 'paragraph_open' &&
      tokens[i - 2]!.type === 'list_item_open';
    if (!isListItemParagraph) {
      continue;
    }
    const first = token.children[0]!;
    if (first.type !== 'text') {
      continue;
    }
    const match = /^\[([ xX])\]\s+/.exec(first.content);
    if (!match) {
      continue;
    }
    const checked = match[1] !== ' ';
    first.content = first.content.slice(match[0].length);
    const checkbox = new state.Token('html_inline', '', 0);
    checkbox.content = `<input type="checkbox" disabled${checked ? ' checked' : ''}> `;
    token.children.unshift(checkbox);

    // Mark the enclosing list item so it can be styled without a bullet.
    const li = tokens[i - 2]!;
    li.attrJoin('class', 'task-list-item');
  }
  return true;
});

/**
 * Render markdown to sanitized, embeddable HTML.
 *
 * External links are forced to `target="_blank" rel="noopener noreferrer"`.
 * Anything dangerous (`<script>`, `on*=` handlers, `javascript:` URLs, frames)
 * is stripped by DOMPurify and never executes.
 */
export function render(markdown: string): string {
  const rawHtml = md.render(markdown);
  const safe = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
  return hardenExternalLinks(safe);
}

/**
 * Force external (`http(s)://`) anchors to open safely in a new tab. Runs on
 * the sanitized HTML so we only touch links DOMPurify already approved.
 */
function hardenExternalLinks(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return doc.body.innerHTML;
}
