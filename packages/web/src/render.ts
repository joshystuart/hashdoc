import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

md.enable(['table', 'strikethrough']);

md.core.ruler.after('inline', 'portablemd_task_lists', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'inline' || !token.children || token.children.length === 0) {
      continue;
    }
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

    const li = tokens[i - 2]!;
    li.attrJoin('class', 'task-list-item');
  }
  return true;
});

installHeadingAnchors(md);

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'section';
}

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

installMathRules(md);

function installMathRules(instance: MarkdownIt): void {
  instance.inline.ruler.after('escape', 'portablemd_math_inline', (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) === 0x24) {
      return false;
    }
    const afterOpen = state.src.charCodeAt(start + 1);
    if (Number.isNaN(afterOpen) || afterOpen === 0x20 || afterOpen === 0x0a) {
      return false;
    }
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

      let nextLine = startLine;
      let haveEnd = false;
      const firstLine = state.src.slice(startPos + 2, maxPos);
      const trimmedFirst = firstLine.trimEnd();
      const lines: string[] = [];
      if (trimmedFirst.endsWith('$$') && trimmedFirst.length >= 2) {
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

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function render(markdown: string): string {
  const rawHtml = md.render(markdown);
  const safe = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
  return postProcess(safe);
}

function postProcess(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }

  // DOMPurify strips `id` as DOM-clobbering protection; re-derive from anchor href.
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

const CODE_BLOCK_SELECTOR = 'pre > code[class*="language-"]';
const MERMAID_BLOCK_SELECTOR = 'pre > code.language-mermaid';
const MATH_PLACEHOLDER_SELECTOR = '.math-inline[data-tex], .math-block[data-tex]';

export function hasCodeBlocks(container: HTMLElement): boolean {
  return container.querySelector(CODE_BLOCK_SELECTOR) !== null;
}

export function hasMermaidBlocks(container: HTMLElement): boolean {
  return container.querySelector(MERMAID_BLOCK_SELECTOR) !== null;
}

export function hasMath(container: HTMLElement): boolean {
  return container.querySelector(MATH_PLACEHOLDER_SELECTOR) !== null;
}

function isMermaidBlock(code: HTMLElement): boolean {
  return code.classList.contains('language-mermaid');
}

export async function enhance(container: HTMLElement): Promise<void> {
  await enhanceMermaid(container);
  await enhanceHighlight(container);
  await enhanceMath(container);
  enhanceCopyCode(container);
}

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

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

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
    // location.hash holds the document payload — never navigate it.
    event.preventDefault();
    const dest = container.querySelector(`#${cssEscape(id)}`);
    if (dest instanceof HTMLElement) {
      dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  if (css && typeof css.escape === 'function') {
    return css.escape(value);
  }
  return value.replace(/[^\w-]/g, (ch) => `\\${ch}`);
}

export function firstHeadingText(markdown: string): string | null {
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    const match = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      return match[1]!.replace(/[*_`~]/g, '').trim();
    }
  }
  return null;
}

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
    el.dataset.math = 'done';
    try {
      const rawHtml = renderMath(tex, displayMode);
      el.innerHTML = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true, mathMl: true },
        FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      });
    } catch {
      el.textContent = tex;
      delete el.dataset.math;
    }
  }
}

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
    const tokenized = highlightCode(code.textContent ?? '', language);
    code.innerHTML = DOMPurify.sanitize(tokenized, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    });
    code.classList.add('hljs');
    code.dataset.highlighted = 'yes';
  }
}

let mermaidSeq = 0;

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
    code.dataset.mermaid = 'done';
    try {
      const id = `portablemd-mermaid-${mermaidSeq++}`;
      const rawSvg = await renderMermaid(id, source);
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
      delete code.dataset.mermaid;
    }
  }
}

function languageOf(code: HTMLElement): string | undefined {
  for (const cls of Array.from(code.classList)) {
    const match = /^language-(.+)$/.exec(cls);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}
