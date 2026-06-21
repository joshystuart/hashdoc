import { describe, expect, it } from 'vitest';
import { render } from './render.js';

describe('render — GFM constructs', () => {
  it('renders tables', () => {
    const html = render('| a | b |\n| - | - |\n| 1 | 2 |\n');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders strikethrough', () => {
    expect(render('~~gone~~')).toContain('<s>gone</s>');
  });

  it('renders task lists as checkboxes', () => {
    const html = render('- [x] done\n- [ ] todo\n');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
    expect(html).toContain('disabled');
  });

  it('renders headings, emphasis and code', () => {
    const html = render('# Title\n\n**bold** and `code`');

    expect(html).toContain('<h1 id="title">');
    expect(html).toContain('Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('linkifies bare URLs', () => {
    expect(render('see https://example.com here')).toContain(
      'href="https://example.com"',
    );
  });
});

describe('render — security (XSS) suite', () => {
  it('strips <script> tags and they do not survive in output', () => {
    const html = render('hi\n\n<script>window.__pwned = true</script>\n');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('__pwned');
  });

  it('strips onerror= handlers on images', () => {
    const html = render('<img src="x" onerror="window.__pwned=1">');
    expect(html).not.toMatch(/onerror/i);
  });

  it('never produces an executable javascript: href (markdown link syntax)', () => {
    const html = render('[click](javascript:alert(1))');

    expect(html).not.toMatch(/href=["']javascript:/i);
  });

  it('strips javascript: hrefs supplied via raw HTML', () => {
    const html = render('<a href="javascript:alert(1)">x</a>');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('strips iframes/frames', () => {
    const html = render('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toMatch(/<iframe/i);
  });

  it('strips inline event handlers on arbitrary elements', () => {
    const html = render('<div onclick="window.__pwned=1">x</div>');
    expect(html).not.toMatch(/onclick/i);
  });

  it('forces external links to open safely', () => {
    const html = render('[ext](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('preserves author-embedded image URLs (author content, not infra)', () => {
    const html = render('![alt](https://cdn.example.com/pic.png)');
    expect(html).toContain('src="https://cdn.example.com/pic.png"');
  });
});

describe('render — heading anchors (issue-09)', () => {
  it('gives each heading a slug id', () => {
    const html = render('# Hello World\n\n## A Section!');
    expect(html).toContain('id="hello-world"');
    expect(html).toContain('id="a-section"');
  });

  it('de-duplicates repeated heading slugs', () => {
    const html = render('# Intro\n\n# Intro\n\n# Intro');
    expect(html).toContain('id="intro"');
    expect(html).toContain('id="intro-2"');
    expect(html).toContain('id="intro-3"');
  });

  it('prepends a clickable in-page anchor to each heading', () => {
    const html = render('# Title');
    expect(html).toContain('class="heading-anchor"');
    expect(html).toContain('href="#title"');
  });

  it('survives DOMPurify with the id and anchor intact', () => {
    const html = render('## Keep Me');
    expect(html).toMatch(/<h2[^>]*id="keep-me"/);
    expect(html).toContain('aria-label="Link to this section"');
  });
});

describe('firstHeadingText (issue-09)', () => {
  it('returns the first H1 text', async () => {
    const { firstHeadingText } = await import('./render.js');
    expect(firstHeadingText('# My Doc\n\nbody')).toBe('My Doc');
  });

  it('ignores deeper headings and finds the H1 after blank lines', async () => {
    const { firstHeadingText } = await import('./render.js');
    expect(firstHeadingText('\n\n## sub\n\n# Real Title')).toBe('Real Title');
  });

  it('strips inline markdown markers from the title', async () => {
    const { firstHeadingText } = await import('./render.js');
    expect(firstHeadingText('# **Bold** `title`')).toBe('Bold title');
  });

  it('returns null when there is no H1', async () => {
    const { firstHeadingText } = await import('./render.js');
    expect(firstHeadingText('## only sub\n\nbody')).toBeNull();
  });
});

describe('enhanceCopyCode (issue-09)', () => {
  it('adds a Copy button to each code block and copies the raw source', async () => {
    const { enhanceCopyCode } = await import('./render.js');
    const container = document.createElement('div');
    container.innerHTML = render('```js\nconst a = 1;\n```');

    const writes: string[] = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: (t: string) => {
          writes.push(t);
          return Promise.resolve();
        },
      },
    });

    enhanceCopyCode(container);

    const button =
      container.querySelector<HTMLButtonElement>('.code-block__copy');
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-label')).toBe('Copy code');
    button!.click();
    await Promise.resolve();
    expect(writes).toEqual(['const a = 1;\n']);
  });

  it('is idempotent — repeated runs do not stack buttons', async () => {
    const { enhanceCopyCode } = await import('./render.js');
    const container = document.createElement('div');
    container.innerHTML = render('```\nx\n```');
    enhanceCopyCode(container);
    enhanceCopyCode(container);
    expect(container.querySelectorAll('.code-block__copy').length).toBe(1);
  });
});
