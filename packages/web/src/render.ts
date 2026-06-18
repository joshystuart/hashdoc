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

/**
 * Selector for fenced code blocks that {@link render} emits: markdown-it writes
 * `<pre><code class="language-xxx">…escaped source…</code></pre>`.
 */
const CODE_BLOCK_SELECTOR = 'pre > code[class*="language-"]';

/**
 * True when the rendered HTML contains at least one fenced code block. Used to
 * decide whether the heavy highlighter is worth loading at all.
 */
export function hasCodeBlocks(container: HTMLElement): boolean {
  return container.querySelector(CODE_BLOCK_SELECTOR) !== null;
}

/**
 * Shared post-render enhancement: syntax-highlight every fenced code block in
 * `container`, in place. Used identically by the Viewer (after mount) and the
 * Editor preview (after each render), so highlighted output can never diverge
 * between the two — it is the single highlighting code path.
 *
 * highlight.js (and its theme CSS) is pulled in via dynamic `import()` ONLY when
 * a code block is actually present, so it lands in a separate async chunk and
 * Documents without code stay featherweight (it never enters the Viewer entry).
 *
 * Sanitization is preserved: highlight.js produces only structural `<span>`
 * tokens, and we still run its output back through DOMPurify before it touches
 * the live DOM — a malicious language name or `<script>`-laden code block can
 * never inject executable markup.
 */
export async function enhance(container: HTMLElement): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTOR),
  );
  if (blocks.length === 0) {
    return;
  }

  const { highlightCode } = await import('./highlight.js');

  for (const code of blocks) {
    if (code.dataset.highlighted === 'yes') {
      continue;
    }
    const language = languageOf(code);
    // highlight() escapes its input and returns structural-span HTML. We still
    // sanitize the result before assigning it — defence in depth, no bypass.
    const tokenized = highlightCode(code.textContent ?? '', language);
    code.innerHTML = DOMPurify.sanitize(tokenized, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    });
    code.classList.add('hljs');
    code.dataset.highlighted = 'yes';
  }
}

/**
 * Extract the fence language from a code element's `language-xxx` class, if it
 * is one highlight.js knows about. Returns `undefined` for unknown or absent
 * languages so the caller can fall back to plain (un-highlighted) text rather
 * than letting highlight.js guess.
 */
function languageOf(code: HTMLElement): string | undefined {
  for (const cls of Array.from(code.classList)) {
    const match = /^language-(.+)$/.exec(cls);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}
