import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, hasMermaidBlocks } from './render.js';

function mount(markdown: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = render(markdown);
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('render — mermaid fence shape', () => {
  it('emits a plain language-mermaid code block (no diagram yet)', () => {
    const el = mount('```mermaid\ngraph TD; A-->B;\n```\n');
    const code = el.querySelector('pre > code.language-mermaid');
    expect(code).not.toBeNull();

    expect(code!.textContent).toContain('graph TD; A-->B;');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('hasMermaidBlocks detects mermaid fences and ignores plain code', () => {
    expect(hasMermaidBlocks(mount('```mermaid\ngraph TD; A-->B;\n```\n'))).toBe(true);
    expect(hasMermaidBlocks(mount('```js\nconst x = 1;\n```\n'))).toBe(false);
    expect(hasMermaidBlocks(mount('# just prose\n'))).toBe(false);
  });
});

describe('enhance — mermaid rendering wiring (mocked island)', () => {
  it('replaces a mermaid block with the rendered SVG', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: vi.fn(async (id: string) => `<svg id="${id}"><g><text>A</text></g></svg>`),
    }));

    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\ngraph TD; A-->B;\n```\n');

    await e(el);

    expect(el.querySelector('pre')).toBeNull();
    const svg = el.querySelector('figure.mermaid > svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('text')!.textContent).toBe('A');
  });

  it('passes the raw diagram source (the code text) to the renderer', async () => {
    const spy = vi.fn(async (_id: string, _source: string) => '<svg></svg>');
    vi.doMock('./mermaid.js', () => ({ renderMermaid: spy }));
    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n');

    await e(el);

    expect(spy).toHaveBeenCalledTimes(1);
    const source = spy.mock.calls[0]![1];
    expect(source).toContain('sequenceDiagram');
    expect(source).toContain('A->>B: hi');
  });

  it('leaves the inert block in place if mermaid throws (malformed diagram)', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: vi.fn(async () => {
        throw new Error('parse error');
      }),
    }));
    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\nnot a real diagram\n```\n');

    await e(el);


    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('pre > code.language-mermaid')).not.toBeNull();
    expect(el.textContent).toContain('not a real diagram');
  });
});

describe('enhance — mermaid output sanitization (no DOMPurify bypass)', () => {
  it('strips <script> smuggled in the renderer SVG output', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: vi.fn(
        async () => '<svg><script>window.__pwned = 1<\/script><g><text>ok</text></g></svg>',
      ),
    }));
    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\ngraph TD; A-->B;\n```\n');

    await e(el);

    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML).not.toMatch(/<script/i);

    expect(el.querySelector('figure.mermaid svg text')!.textContent).toBe('ok');
  });

  it('strips on* event handlers from the renderer SVG output', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: vi.fn(
        async () => '<svg><image href="x" onerror="window.__pwned=1"/><rect onclick="alert(1)"/></svg>',
      ),
    }));
    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\ngraph TD; A-->B;\n```\n');

    await e(el);

    expect(el.innerHTML).not.toMatch(/onerror/i);
    expect(el.innerHTML).not.toMatch(/onclick/i);
    expect(el.querySelector('[onerror]')).toBeNull();
    expect(el.querySelector('[onclick]')).toBeNull();
  });

  it('drops javascript: / foreignObject HTML-injection vectors', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: vi.fn(
        async () =>
          '<svg><foreignObject><body><img src=x onerror="alert(1)"></body></foreignObject><a href="javascript:alert(1)"><text>t</text></a></svg>',
      ),
    }));
    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\ngraph TD; A-->B;\n```\n');

    await e(el);

    expect(el.querySelector('foreignObject')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.innerHTML).not.toMatch(/javascript:/i);
    expect(el.innerHTML).not.toMatch(/onerror/i);
  });
});

describe('enhance — mermaid does not collide with highlight.js', () => {
  it('a mermaid block is NOT syntax-highlighted (no hljs class)', async () => {
    vi.doMock('./mermaid.js', () => ({
      renderMermaid: vi.fn(async () => '<svg><text>diagram</text></svg>'),
    }));
    const { render: r, enhance: e } = await import('./render.js');
    const el = document.createElement('div');
    el.innerHTML = r('```mermaid\ngraph TD; A-->B;\n```\n\n```js\nconst x = 1;\n```\n');

    await e(el);


    expect(el.querySelector('figure.mermaid svg')).not.toBeNull();

    const code = el.querySelector('pre > code');
    expect(code!.classList.contains('hljs')).toBe(true);
    expect(code!.innerHTML).toMatch(/hljs-/);
  });
});
