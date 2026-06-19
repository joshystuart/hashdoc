import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, enhance } from './render.js';

function mount(markdown: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = render(markdown);
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('render() — script & event-handler vectors', () => {
  it('strips <script> tags (raw HTML)', () => {
    const html = render('hi\n\n<script>window.__pwned = true</script>\n');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('__pwned');
  });

  it('strips <script> smuggled with odd casing / attributes', () => {
    const html = render('<ScRiPt type="text/javascript">alert(1)</ScRiPt>');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('alert(1)');
  });

  it('strips onerror= handlers on images', () => {
    const html = render('<img src="x" onerror="window.__pwned=1">');
    expect(html).not.toMatch(/onerror/i);
  });

  it('strips onclick / onload / onmouseover handlers on arbitrary elements', () => {
    const html = render(
      '<div onclick="a()" onmouseover="b()"><p onload="c()">x</p></div>',
    );
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/onmouseover/i);
    expect(html).not.toMatch(/onload/i);
  });

  it('strips onfocus + autofocus auto-trigger vector', () => {
    const html = render('<input autofocus onfocus="window.__pwned=1">');
    expect(html).not.toMatch(/onfocus/i);
  });
});

describe('render() — URL scheme vectors', () => {
  it('never produces an executable javascript: href (markdown link syntax)', () => {
    const html = render('[click](javascript:alert(1))');
    expect(html).not.toMatch(/href=["']javascript:/i);
  });

  it('strips javascript: hrefs supplied via raw HTML', () => {
    const html = render('<a href="javascript:alert(1)">x</a>');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('strips javascript: hrefs with embedded whitespace/entities', () => {
    const html = render('<a href="java\tscript:alert(1)">x</a>');
    const hrefs = html.match(/href=["']([^"']*)["']/gi) ?? [];
    for (const href of hrefs) {
      expect(href.replace(/\s/g, '').toLowerCase()).not.toContain('javascript:');
    }
  });

  it('neutralizes data: URI scripting in an anchor href', () => {
    const html = render('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(html).not.toMatch(/<script/i);
    const hrefs = html.match(/href=["']([^"']*)["']/gi) ?? [];
    for (const href of hrefs) {
      expect(href.toLowerCase()).not.toContain('data:text/html');
    }
  });
});

describe('render() — SVG-based vectors', () => {
  it('strips <svg><script>', () => {
    const html = render('<svg><script>alert(1)</script></svg>');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('alert(1)');
  });

  it('strips <svg onload=…>', () => {
    const html = render('<svg onload="window.__pwned=1"></svg>');
    expect(html).not.toMatch(/onload/i);
  });

  it('strips <svg><a xlink:href="javascript:…">', () => {
    const html = render('<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('strips <foreignObject> HTML smuggling inside svg', () => {
    const html = render('<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>');
    expect(html).not.toMatch(/onerror/i);
  });
});

describe('render() — frame & object injection', () => {
  it('strips <iframe>', () => {
    const html = render('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toMatch(/<iframe/i);
  });

  it('strips <frame>/<frameset>', () => {
    const html = render('<frameset><frame src="https://evil.example"></frameset>');
    expect(html).not.toMatch(/<frame/i);
  });

  it('strips <object> and <embed>', () => {
    const html = render('<object data="x.swf"></object><embed src="x.swf">');
    expect(html).not.toMatch(/<object/i);
    expect(html).not.toMatch(/<embed/i);
  });

  it('strips <base> (could rewrite relative URL resolution)', () => {
    const html = render('<base href="https://evil.example/">');
    expect(html).not.toMatch(/<base/i);
  });
});

describe('render() — external link hardening', () => {
  it('forces external links to target=_blank rel=noopener noreferrer', () => {
    const html = render('[ext](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('preserves author-embedded image URLs (author content, not infra)', () => {
    const html = render('![alt](https://example.com/cat.png)');
    expect(html).toContain('src="https://example.com/cat.png"');
  });
});

describe('render() — malicious code-block content stays inert', () => {
  it('escapes <script> inside a fenced code block (rendered as text, not executed)', () => {
    const html = render('```\n<script>alert(1)</script>\n```');
    expect(html).not.toMatch(/<script>alert/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('treats a malicious language name as an inert class, never a live element', () => {
    const html = render('```"><img src=x onerror=alert(1)>\ncode\n```');
    expect(html).not.toMatch(/onerror/i);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('img'), 'no live <img> may be injected').toBeNull();
  });
});

describe('enhance islands — sanitize their own (possibly hostile) output', () => {
  it('highlight island: hostile highlighter output is sanitized before insertion', async () => {
    vi.doMock('./highlight.js', () => ({
      highlightCode: () => '<span onclick="alert(1)">x</span><script>alert(2)</script>',
    }));
    const { enhance: enhanceMocked, render: renderMocked } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = renderMocked('```js\nconst x = 1;\n```');
    document.body.append(el);
    await enhanceMocked(el);
    expect(el.innerHTML).not.toMatch(/<script/i);
    expect(el.innerHTML).not.toMatch(/onclick/i);
  });

  it('mermaid island: hostile SVG (script + onload) is sanitized before insertion', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: async () =>
        '<svg onload="window.__pwned=1"><script>alert(1)</script><rect/></svg>',
    }));
    const { enhance: enhanceMocked, render: renderMocked } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = renderMocked('```mermaid\ngraph TD; A-->B;\n```');
    document.body.append(el);
    await enhanceMocked(el);
    expect(el.innerHTML).not.toMatch(/<script/i);
    expect(el.innerHTML).not.toMatch(/onload/i);
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('katex island: hostile KaTeX output (script + handler) is sanitized before insertion', async () => {
    vi.doMock('./katex.js', () => ({
      renderMath: () =>
        '<span class="katex" onmouseover="alert(1)"><script>alert(2)</script>x</span>',
    }));
    const { enhance: enhanceMocked, render: renderMocked } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = renderMocked('inline $x^2$ math');
    document.body.append(el);
    await enhanceMocked(el);
    expect(el.innerHTML).not.toMatch(/<script/i);
    expect(el.innerHTML).not.toMatch(/onmouseover/i);
  });
});

describe('enhance — does not introduce handlers for benign content', () => {
  it('leaves a clean document free of script/handler markup after enhance', async () => {
    const el = mount('# Title\n\nSome **safe** text and a [link](https://example.com).');
    await enhance(el);
    expect(el.innerHTML).not.toMatch(/<script/i);
    expect(el.innerHTML).not.toMatch(/\son\w+=/i);
  });
});
