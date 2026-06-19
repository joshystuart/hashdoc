import { describe, expect, it } from 'vitest';
import { render, enhance, hasCodeBlocks } from './render.js';

function mount(markdown: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = render(markdown);
  return el;
}

describe('enhance — syntax highlighting', () => {
  it('highlights a fenced js block into hljs token spans', async () => {
    const el = mount('```js\nconst x = 1;\n```\n');
    await enhance(el);
    const code = el.querySelector('pre > code')!;
    expect(code.classList.contains('hljs')).toBe(true);

    expect(code.innerHTML).toMatch(/<span class="hljs-/);

    expect(code.innerHTML).toContain('hljs-keyword');
    expect(code.textContent).toContain('const x = 1;');
  });

  it('highlights ts and python blocks', async () => {
    const el = mount('```ts\ntype A = number;\n```\n\n```python\ndef f():\n    return 1\n```\n');
    await enhance(el);
    const blocks = el.querySelectorAll('pre > code');
    expect(blocks).toHaveLength(2);
    for (const b of Array.from(blocks)) {
      expect(b.classList.contains('hljs')).toBe(true);
      expect(b.innerHTML).toMatch(/<span class="hljs-/);
    }
  });

  it('leaves a Document with no code fences untouched (no highlight needed)', async () => {
    const el = mount('# Heading\n\nJust **prose**, no code.\n');
    expect(hasCodeBlocks(el)).toBe(false);
    const before = el.innerHTML;
    await enhance(el);

    expect(el.innerHTML).toBe(before);
  });

  it('is idempotent: re-running enhance does not double-process', async () => {
    const el = mount('```js\nconst x = 1;\n```\n');
    await enhance(el);
    const once = el.innerHTML;
    await enhance(el);
    expect(el.innerHTML).toBe(once);
  });

  it('an unknown language is escaped, not guessed or injected', async () => {
    const el = mount('```not-a-real-lang\n<b>plain</b> & "text"\n```\n');
    await enhance(el);
    const code = el.querySelector('pre > code')!;

    expect(code.querySelector('b')).toBeNull();
    expect(code.textContent).toContain('<b>plain</b>');
  });
});

describe('enhance — sanitization holds (no DOMPurify bypass)', () => {
  it('a script-laden code block does not produce executable markup', async () => {
    const el = mount('```js\n<script>window.__pwned = 1<\/script>\n```\n');
    await enhance(el);
    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML).not.toMatch(/<script/i);

    expect(el.textContent).toContain('window.__pwned = 1');
  });

  it('a malicious language name cannot inject attributes or tags', async () => {


    const el = mount('```js" onload="alert(1)\nconst x = 1;\n```\n');
    await enhance(el);
    expect(el.innerHTML).not.toMatch(/onload/i);
    expect(el.querySelector('[onload]')).toBeNull();
  });

  it('an img/onerror payload smuggled in code is inert after enhance', async () => {
    const el = mount('```html\n<img src=x onerror="window.__pwned=1">\n```\n');
    await enhance(el);

    expect(el.querySelector('img')).toBeNull();
    expect(el.innerHTML).not.toMatch(/onerror=/i);
  });
});

describe('enhance — Viewer and Editor preview produce identical output', () => {
  it('two independently-enhanced containers of the same markdown match', async () => {
    const md = '# Doc\n\n```js\nfunction greet(name) {\n  return `hi ${name}`;\n}\n```\n';
    const viewerLike = mount(md);
    const previewLike = mount(md);
    await enhance(viewerLike);
    await enhance(previewLike);
    expect(viewerLike.innerHTML).toBe(previewLike.innerHTML);
  });
});
