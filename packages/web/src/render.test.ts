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
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('linkifies bare URLs', () => {
    expect(render('see https://example.com here')).toContain('href="https://example.com"');
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
    // markdown-it refuses the unsafe scheme and leaves it as inert text — no anchor.
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
