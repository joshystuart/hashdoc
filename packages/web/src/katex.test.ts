import { describe, expect, it } from 'vitest';
import { render, enhance, hasMath } from './render.js';

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

    expect(span!.textContent).toContain('x');
  });

  it('renders block `$$\\int$$` to display-mode .katex output', async () => {
    const el = mount('$$\n\\int_0^1 x\\,dx\n$$\n');
    await enhance(el);
    const div = el.querySelector('div.math-block');
    expect(div).not.toBeNull();
    expect(div!.querySelector('.katex')).not.toBeNull();

    expect(div!.querySelector('.katex-display')).not.toBeNull();
  });

  it('leaves the inert placeholder (showing raw TeX) when KaTeX cannot parse', async () => {
    const el = mount('Bad $\\nonexistentmacro{x}$ math.\n');
    await enhance(el);
    const span = el.querySelector('span.math-inline');
    expect(span).not.toBeNull();
    expect(span!.querySelector('.katex')).toBeNull();

    expect(span!.textContent).toContain('\\nonexistentmacro');
  });
});

describe('enhance — KaTeX output sanitization (no DOMPurify bypass)', () => {
  it('does not let `\\href` produce a live javascript: link or script', async () => {





    const el = document.createElement('div');
    el.innerHTML = render('$\\href{javascript:alert(1)}{x}$\n');
    await enhance(el);
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('a[href^="javascript:" i]')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();
    expect(el.querySelector('[onclick]')).toBeNull();
  });

  it('cannot smuggle raw HTML through the TeX source', async () => {


    const el = document.createElement('div');
    el.innerHTML = render('$\\text{<img src=x onerror=alert(1)>}$\n');
    await enhance(el);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();

    const katex = el.querySelector('span.math-inline .katex');
    expect(katex).not.toBeNull();
    expect(katex!.querySelector('img')).toBeNull();
  });
});

describe('enhance — math does not collide with code / mermaid', () => {
  it('a code block with `$$` text is NOT turned into math', async () => {
    const el = mount('```js\nconst price = "$$";\n```\n\nAnd $a+b$ inline.\n');
    await enhance(el);

    const code = el.querySelector('pre > code');
    expect(code!.classList.contains('hljs')).toBe(true);

    expect(el.querySelector('span.math-inline .katex')).not.toBeNull();
  });
});
