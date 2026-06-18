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

// --- Heading anchors (issue-09): give every heading a stable, unique slug `id`
//     and a clickable `#` anchor. The anchor is a plain in-page `<a href="#slug">`
//     — which WOULD clobber the payload fragment if the browser navigated it — so
//     the Viewer intercepts in-page anchor clicks and uses scrollIntoView instead
//     (see interceptInPageAnchors). Slugging happens at parse time so the markup
//     still flows through DOMPurify (ids and the anchor element are allowed).
installHeadingAnchors(md);

/**
 * Turn a heading's text into a URL slug: lowercase, spaces/punctuation to
 * hyphens, collapsed and trimmed. Empty results fall back to `section`.
 */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'section';
}

/**
 * Wire heading slug + anchor generation onto a markdown-it instance. Each
 * `heading_open` gets a unique `id`; a `#` anchor linking to that id is injected
 * at the START of the heading's inline content. Slugs are de-duplicated within a
 * single render with `-2`, `-3`, … suffixes so deep-links stay stable.
 */
function installHeadingAnchors(instance: MarkdownIt): void {
  instance.core.ruler.push('portablemd_heading_anchors', (state) => {
    const tokens = state.tokens;
    const seen = new Map<string, number>();
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i]!;
      if (open.type !== 'heading_open') {
        continue;
      }
      const inline = tokens[i + 1];
      if (!inline || inline.type !== 'inline') {
        continue;
      }
      const base = slugify(inline.content);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const slug = count === 0 ? base : `${base}-${count + 1}`;
      open.attrSet('id', slug);

      // Prepend a `#` anchor to the heading's inline children. It is a normal
      // in-page link; the Viewer intercepts its click to stay payload-safe.
      const anchorOpen = new state.Token('link_open', 'a', 1);
      anchorOpen.attrSet('href', `#${slug}`);
      anchorOpen.attrSet('class', 'heading-anchor');
      anchorOpen.attrSet('aria-label', 'Link to this section');
      const anchorText = new state.Token('html_inline', '', 0);
      anchorText.content = '#';
      const anchorClose = new state.Token('link_close', 'a', -1);
      inline.children = [anchorOpen, anchorText, anchorClose, ...(inline.children ?? [])];
    }
    return true;
  });
}

// --- Math: parse `$…$` (inline) and `$$…$$` (block) into INERT placeholder
//     elements carrying the raw TeX in `data-tex`. Parsing is cheap and sync;
//     the heavy KaTeX library is NOT loaded here — enhanceMath() lazy-imports it
//     and renders these placeholders only when they are actually present. The
//     placeholders are HTML the renderer emits as plain text content, then
//     DOMPurify keeps the `<span>/<div>` + `data-tex` (data-* is allowed).
installMathRules(md);

/**
 * Wire up inline (`$…$`) and block (`$$…$$`) math parsing on a markdown-it
 * instance. Each match becomes an `html_inline`/`html_block` token holding an
 * inert placeholder element with the raw TeX in `data-tex` — no rendering here.
 */
function installMathRules(instance: MarkdownIt): void {
  // Inline `$…$`. Not `$$` (that's block), not an empty `$$`, no space right
  // after the opening `$` (so "$5 and $6" stays plain text), and the closing
  // `$` must not be preceded by a space and not be a digit right after (common
  // currency: "it costs $5"). We keep it conservative to avoid eating prose.
  instance.inline.ruler.after('escape', 'portablemd_math_inline', (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) {
      return false;
    }
    // A `$$` here is handled by the block rule / not inline.
    if (state.src.charCodeAt(start + 1) === 0x24) {
      return false;
    }
    // No whitespace immediately after the opening delimiter.
    const afterOpen = state.src.charCodeAt(start + 1);
    if (Number.isNaN(afterOpen) || afterOpen === 0x20 || afterOpen === 0x0a) {
      return false;
    }
    // Find the closing `$`, allowing `\$` escapes inside.
    let pos = start + 1;
    const max = state.posMax;
    let found = -1;
    while (pos < max) {
      const code = state.src.charCodeAt(pos);
      if (code === 0x5c /* \ */) {
        pos += 2;
        continue;
      }
      if (code === 0x24 /* $ */) {
        found = pos;
        break;
      }
      pos += 1;
    }
    if (found < 0) {
      return false;
    }
    // No whitespace immediately before the closing delimiter; non-empty body.
    const beforeClose = state.src.charCodeAt(found - 1);
    if (found === start + 1 || beforeClose === 0x20 || beforeClose === 0x0a) {
      return false;
    }
    const tex = state.src.slice(start + 1, found);
    if (!silent) {
      const token = state.push('html_inline', '', 0);
      token.content = `<span class="math-inline" data-tex="${escapeAttr(tex)}"></span>`;
    }
    state.pos = found + 1;
    return true;
  });

  // Block `$$…$$`. Recognised when a line begins with `$$`. The body runs to the
  // line that ends with a closing `$$` (which may be the same line).
  instance.block.ruler.before(
    'fence',
    'portablemd_math_block',
    (state, startLine, endLine, silent) => {
      const startPos = state.bMarks[startLine]! + state.tShift[startLine]!;
      const maxPos = state.eMarks[startLine]!;
      if (startPos + 2 > maxPos) {
        return false;
      }
      if (state.src.charCodeAt(startPos) !== 0x24 || state.src.charCodeAt(startPos + 1) !== 0x24) {
        return false;
      }
      if (silent) {
        return true;
      }

      // Collect lines until we hit a line ending in `$$`. Support same-line
      // close: `$$ x $$`.
      let nextLine = startLine;
      let haveEnd = false;
      const firstLine = state.src.slice(startPos + 2, maxPos);
      const trimmedFirst = firstLine.trimEnd();
      const lines: string[] = [];
      if (trimmedFirst.endsWith('$$') && trimmedFirst.length >= 2) {
        // Same-line close.
        lines.push(trimmedFirst.slice(0, -2));
        haveEnd = true;
      } else {
        lines.push(firstLine);
        nextLine = startLine + 1;
        for (; nextLine < endLine; nextLine++) {
          const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!;
          const lineMax = state.eMarks[nextLine]!;
          const text = state.src.slice(state.bMarks[nextLine]!, lineMax);
          const trimmed = state.src.slice(lineStart, lineMax).trimEnd();
          if (trimmed.endsWith('$$')) {
            lines.push(trimmed.slice(0, -2));
            haveEnd = true;
            break;
          }
          lines.push(text);
        }
      }
      if (!haveEnd) {
        return false;
      }

      const tex = lines.join('\n').trim();
      const token = state.push('html_block', '', 0);
      token.map = [startLine, nextLine + 1];
      token.content = `<div class="math-block" data-tex="${escapeAttr(tex)}"></div>\n`;
      state.line = nextLine + 1;
      return true;
    },
  );
}

/** Escape a string for safe inclusion in a double-quoted HTML attribute. */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  return postProcess(safe);
}

/**
 * Post-sanitize DOM pass over the HTML DOMPurify already approved:
 *
 * 1. Force external (`http(s)://`) anchors to open safely in a new tab.
 * 2. Restore heading `id` slugs (issue-09). DOMPurify strips `id` attributes as
 *    DOM-clobbering protection, and disabling that protection globally would
 *    weaken sanitisation for the whole Document. Instead we re-derive each
 *    heading's slug from the `#` anchor the markdown-it rule injected (its
 *    `href="#slug"` survives sanitisation) and re-apply it as the heading `id`.
 *    This keeps clobbering protection on everywhere else while giving headings
 *    stable, deep-linkable ids.
 */
function postProcess(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }

  for (const heading of Array.from(
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6'),
  )) {
    const anchor = heading.querySelector(':scope > a.heading-anchor[href^="#"]');
    const href = anchor?.getAttribute('href') ?? '';
    const slug = href.slice(1);
    if (slug !== '') {
      heading.setAttribute('id', slug);
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
 * Selector for the `mermaid` fences markdown-it emits as
 * `<pre><code class="language-mermaid">…escaped diagram source…</code></pre>`.
 * These are NOT syntax-highlighted — they are rendered to diagrams instead.
 */
const MERMAID_BLOCK_SELECTOR = 'pre > code.language-mermaid';

/**
 * Selector for the inert math placeholders {@link render} emits:
 * `<span class="math-inline" data-tex="…">` and
 * `<div class="math-block" data-tex="…">`. {@link enhanceMath} replaces these
 * with KaTeX output (lazy-loaded) only when at least one is present.
 */
const MATH_PLACEHOLDER_SELECTOR = '.math-inline[data-tex], .math-block[data-tex]';

/**
 * True when the rendered HTML contains at least one fenced code block. Used to
 * decide whether the heavy highlighter is worth loading at all.
 */
export function hasCodeBlocks(container: HTMLElement): boolean {
  return container.querySelector(CODE_BLOCK_SELECTOR) !== null;
}

/**
 * True when the rendered HTML contains at least one ```mermaid block. Used to
 * decide whether the heavy Mermaid library is worth loading at all.
 */
export function hasMermaidBlocks(container: HTMLElement): boolean {
  return container.querySelector(MERMAID_BLOCK_SELECTOR) !== null;
}

/**
 * True when the rendered HTML contains at least one math placeholder. Used to
 * decide whether the heavy KaTeX library is worth loading at all.
 */
export function hasMath(container: HTMLElement): boolean {
  return container.querySelector(MATH_PLACEHOLDER_SELECTOR) !== null;
}

/** Is this code element a ```mermaid fence (rendered as a diagram, not highlighted)? */
function isMermaidBlock(code: HTMLElement): boolean {
  return code.classList.contains('language-mermaid');
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
  await enhanceMermaid(container);
  await enhanceHighlight(container);
  await enhanceMath(container);
  enhanceCopyCode(container);
}

/**
 * Give every fenced code block a one-click "Copy" button (issue-09). The button
 * copies the block's RAW text (the un-highlighted source), so it round-trips
 * exactly even after syntax highlighting has rewritten the markup into spans.
 *
 * Runs in {@link enhance}, so both the Viewer and the Editor preview get copy
 * buttons through the single shared code path. The button is wrapped with the
 * `<pre>` in a `.code-block` container so it can be positioned without touching
 * the highlighted markup. Idempotent: a `<pre>` already wrapped is skipped, so
 * repeated enhance() runs (the Editor re-renders on every keystroke) never
 * stack duplicate buttons.
 *
 * Synchronous and zero-dependency: it loads nothing, so it stays in the entry
 * chunk and never affects the lazy-load audits.
 */
export function enhanceCopyCode(container: HTMLElement): void {
  const doc = container.ownerDocument;
  for (const pre of Array.from(container.querySelectorAll<HTMLElement>('pre'))) {
    const code = pre.querySelector('code');
    if (!code || pre.parentElement?.classList.contains('code-block')) {
      continue;
    }
    const wrapper = doc.createElement('div');
    wrapper.className = 'code-block';
    pre.replaceWith(wrapper);
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'code-block__copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code');
    button.addEventListener('click', () => {
      const text = code.textContent ?? '';
      void copyText(text).then((ok) => {
        button.textContent = ok ? 'Copied' : 'Copy failed';
        window.setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      });
    });
    wrapper.append(button, pre);
  }
}

/**
 * Copy `text` to the clipboard, resolving to whether it succeeded. Centralised
 * so every copy action (code, source, link) shares one clipboard path and tests
 * can mock `navigator.clipboard.writeText` once.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Intercept clicks on in-page anchors (`<a href="#…">`) inside `container` and
 * scroll the target into view instead of letting the browser navigate the hash
 * (issue-09).
 *
 * CRITICAL (ADR 0001): the entire Document Payload lives in `location.hash`.
 * Letting a native `#slug` click through would overwrite that fragment and make
 * the Document unreadable on the next decode. So we `preventDefault` and call
 * `scrollIntoView` on the matching `id` — the URL fragment is never touched, the
 * payload is preserved, and the heading still scrolls into view.
 *
 * Returns a disposer that removes the listener.
 */
export function interceptInPageAnchors(container: HTMLElement): () => void {
  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a[href^="#"]') as HTMLAnchorElement | null;
    if (!anchor || !container.contains(anchor)) {
      return;
    }
    const href = anchor.getAttribute('href') ?? '';
    const id = href.slice(1);
    if (id === '') {
      return;
    }
    // Never navigate the hash — that is the payload (ADR 0001).
    event.preventDefault();
    const dest = container.querySelector(`#${cssEscape(id)}`);
    if (dest instanceof HTMLElement) {
      dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

/**
 * Escape a string for use in a CSS id selector. Uses the platform `CSS.escape`
 * when present (browsers, modern jsdom) and falls back to escaping characters
 * outside the safe slug alphabet for older environments.
 */
function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  if (css && typeof css.escape === 'function') {
    return css.escape(value);
  }
  return value.replace(/[^\w-]/g, (ch) => `\\${ch}`);
}

/**
 * The text of the Document's first H1, or `null` when there is none. Used to set
 * the browser tab title (issue-09). Parses the markdown's first ATX `# ` heading
 * — robust to leading blank lines, and indifferent to inline formatting markers.
 */
export function firstHeadingText(markdown: string): string | null {
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    const match = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      // Strip the most common inline markdown markers for a clean title.
      return match[1]!.replace(/[*_`~]/g, '').trim();
    }
  }
  return null;
}

/**
 * Render every math placeholder in `container` to KaTeX output, in place. KaTeX
 * (and its bundled CSS/fonts) is pulled in via dynamic `import()` ONLY when a
 * placeholder is actually present, so it lands in a separate async chunk and
 * never enters the Viewer entry chunk.
 *
 * Math placeholders are `<span class="math-inline">` / `<div class="math-block">`
 * carrying the raw TeX in `data-tex` — they can never collide with mermaid or
 * code-block handling (those operate on `<pre>/<code>`).
 *
 * Security: KaTeX runs with `trust: false`, and the HTML it returns is STILL run
 * back through DOMPurify before insertion — a hostile `\href` or injected markup
 * in the TeX can never execute script. A malformed expression is left as its
 * inert placeholder rather than breaking the whole Document.
 */
async function enhanceMath(container: HTMLElement): Promise<void> {
  const placeholders = Array.from(
    container.querySelectorAll<HTMLElement>(MATH_PLACEHOLDER_SELECTOR),
  ).filter((el) => el.dataset.math !== 'done');
  if (placeholders.length === 0) {
    return;
  }

  const { renderMath } = await import('./katex.js');

  for (const el of placeholders) {
    const tex = el.getAttribute('data-tex') ?? '';
    const displayMode = el.classList.contains('math-block');
    // Mark before rendering so a concurrent re-run cannot double-process.
    el.dataset.math = 'done';
    try {
      const rawHtml = renderMath(tex, displayMode);
      // Sanitize KaTeX's own output. KaTeX emits structural <span> markup plus
      // a <math> MathML mirror; scripts, event handlers and foreign vectors are
      // stripped — defence in depth, no DOMPurify bypass.
      el.innerHTML = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true, mathMl: true },
        FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      });
    } catch {
      // Malformed expression: leave the inert placeholder. Show the raw TeX so
      // the reader at least sees the source rather than an empty gap.
      el.textContent = tex;
      delete el.dataset.math;
    }
  }
}

/**
 * Syntax-highlight every fenced code block in `container`, in place — EXCEPT
 * `mermaid` fences, which {@link enhanceMermaid} turns into diagrams. The heavy
 * highlighter (async chunk) loads only if a non-mermaid code block is present.
 */
async function enhanceHighlight(container: HTMLElement): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTOR),
  ).filter((code) => !isMermaidBlock(code));
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

/** A monotonically increasing counter for unique Mermaid render ids. */
let mermaidSeq = 0;

/**
 * Render every ```mermaid block in `container` to an `<svg>` diagram, in place.
 * Mermaid (a heavy library) is pulled in via dynamic `import()` ONLY when a
 * mermaid block is actually present, so it lands in a separate async chunk and
 * never enters the Viewer entry chunk.
 *
 * Security: the source is the code element's *text content* — already
 * escaped/sanitized plain text from {@link render}. Mermaid runs with
 * `securityLevel: 'strict'`, and the SVG it returns is STILL sanitized through
 * DOMPurify (SVG profile) before insertion, so even Mermaid's own output can
 * never smuggle `<script>` or `on*` handlers into the live DOM. A diagram that
 * fails to parse is left as its original (inert, escaped) code block.
 */
async function enhanceMermaid(container: HTMLElement): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>(MERMAID_BLOCK_SELECTOR),
  ).filter((code) => code.dataset.mermaid !== 'done');
  if (blocks.length === 0) {
    return;
  }

  const { renderMermaid } = await import('./mermaid.js');

  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre) {
      continue;
    }
    const source = code.textContent ?? '';
    // Mark before awaiting so a concurrent re-run cannot double-process the
    // same block; if rendering fails we leave the original block in place.
    code.dataset.mermaid = 'done';
    try {
      const id = `portablemd-mermaid-${mermaidSeq++}`;
      const rawSvg = await renderMermaid(id, source);
      // Sanitize Mermaid's own output. SVG profile keeps legitimate diagram
      // markup; scripts, event handlers and foreign HTML are stripped.
      const safeSvg = DOMPurify.sanitize(rawSvg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'style', 'foreignObject', 'iframe'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      });
      const figure = container.ownerDocument.createElement('figure');
      figure.className = 'mermaid';
      figure.innerHTML = safeSvg;
      pre.replaceWith(figure);
    } catch {
      // Malformed diagram: leave the inert escaped source visible rather than
      // breaking the whole Document. Reset the marker so a later edit can retry.
      delete code.dataset.mermaid;
    }
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
