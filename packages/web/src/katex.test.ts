import { describe, expect, it } from 'vitest';
import { render, enhance, hasMath } from './render.js';

/**
 * issue-08: inline `$…$` and block `$$…$$` math render via KaTeX through the
 * shared enhance step — the SAME path the Viewer and the Editor preview use, so
 * math output is single-sourced.
 *
 * render() stays synchronous and emits inert placeholders
 * (`<span class="math-inline" data-tex="…">` / `<div class="math-block" …>`);
 * enhance() lazy-loads the KaTeX island and replaces each placeholder with
 * sanitized `.katex` HTML. KaTeX is pure HTML/CSS (no browser-layout APIs), so
 * it renders fine under jsdom and we assert REAL output rather than mocking.
 */
function mount(markdown: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = render(markdown);
  return el;
}

describe('render — math placeholder shape', () => {
  it('emits an inline placeholder for `$…$` carrying the raw TeX', () => {
    const el = mount('An equation $x^2$ inline.\n');
    const span = el.querySelector('span.math-inline');
    expect(span).not.toBeNull();
    expect(span!.getAttribute('data-tex')).toBe('x^2');
    // Not rendered yet — no KaTeX output before enhance().
    expect(el.querySelector('.katex')).toBeNull();
  });

  it('emits a block placeholder for `$$…$$` carrying the raw TeX', () => {
    const el = mount('$$\n\\int_0^1 x\\,dx\n$$\n');
    const div = el.querySelector('div.math-block');
    expect(div).not.toBeNull();
    expect(div!.getAttribute('data-tex')).toContain('\\int_0^1');
    expect(el.querySelector('.katex')).toBeNull();
  });

  it('does not treat currency / spaced `$` as math', () => {
    const el = mount('It costs $5 and then $6 total.\n');
    expect(el.querySelector('.math-inline')).toBeNull();
    expect(el.querySelector('.math-block')).toBeNull();
  });

  it('does not treat math inside a code span/block as a placeholder', () => {
    const el = mount('Inline `$x^2$` code and:\n\n```\n$$y$$\n```\n');
    expect(el.querySelector('.math-inline')).toBeNull();
    expect(el.querySelector('.math-block')).toBeNull();
  });

  it('hasMath detects placeholders and ignores plain prose', () => {
    expect(hasMath(mount('$x^2$\n'))).toBe(true);
    expect(hasMath(mount('$$y$$\n'))).toBe(true);
    expect(hasMath(mount('# just prose with $ dollar sign\n'))).toBe(false);
  });
});

describe('enhance — KaTeX rendering (real library, jsdom)', () => {
  it('renders inline `$x^2$` to .katex output', async () => {
    const el = mount('An equation $x^2$ inline.\n');
    await enhance(el);
    const span = el.querySelector('span.math-inline');
    expect(span).not.toBeNull();
    expect(span!.querySelector('.katex')).not.toBeNull();
    // The base content survives (the "x").
    expect(span!.textContent).toContain('x');
  });

  it('renders block `$$\\int$$` to display-mode .katex output', async () => {
    const el = mount('$$\n\\int_0^1 x\\,dx\n$$\n');
    await enhance(el);
    const div = el.querySelector('div.math-block');
    expect(div).not.toBeNull();
    expect(div!.querySelector('.katex')).not.toBeNull();
    // Display mode emits a .katex-display wrapper.
    expect(div!.querySelector('.katex-display')).not.toBeNull();
  });

  it('leaves the inert placeholder (showing raw TeX) when KaTeX cannot parse', async () => {
    const el = mount('Bad $\\nonexistentmacro{x}$ math.\n');
    await enhance(el);
    const span = el.querySelector('span.math-inline');
    expect(span).not.toBeNull();
    expect(span!.querySelector('.katex')).toBeNull();
    // Reader still sees the source rather than an empty gap.
    expect(span!.textContent).toContain('\\nonexistentmacro');
  });
});

describe('enhance — KaTeX output sanitization (no DOMPurify bypass)', () => {
  it('does not let `\\href` produce a live javascript: link or script', async () => {
    // With trust:false, KaTeX refuses \href and renders an inert error span
    // instead of a link. Assert no live <script>, no live anchor with a
    // javascript: href, and no event-handler attribute survive. (The literal
    // string "javascript:" lingers only inside the inert data-tex echo / text,
    // which can never execute — so we assert on the live DOM, not innerHTML.)
    const el = document.createElement('div');
    el.innerHTML = render('$\\href{javascript:alert(1)}{x}$\n');
    await enhance(el);
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('a[href^="javascript:" i]')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();
    expect(el.querySelector('[onclick]')).toBeNull();
  });

  it('cannot smuggle raw HTML through the TeX source', async () => {
    // `\text{<img …>}` is rendered by KaTeX as ESCAPED text, never a real <img>.
    // Assert no live <img>/<script> element and no live event-handler attribute.
    const el = document.createElement('div');
    el.innerHTML = render('$\\text{<img src=x onerror=alert(1)>}$\n');
    await enhance(el);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();
    // The katex-rendered subtree contains only inert escaped text.
    const katex = el.querySelector('span.math-inline .katex');
    expect(katex).not.toBeNull();
    expect(katex!.querySelector('img')).toBeNull();
  });
});

describe('enhance — math does not collide with code / mermaid', () => {
  it('a code block with `$$` text is NOT turned into math', async () => {
    const el = mount('```js\nconst price = "$$";\n```\n\nAnd $a+b$ inline.\n');
    await enhance(el);
    // The js block stays a highlighted code block.
    const code = el.querySelector('pre > code');
    expect(code!.classList.contains('hljs')).toBe(true);
    // The real inline math rendered.
    expect(el.querySelector('span.math-inline .katex')).not.toBeNull();
  });
});
