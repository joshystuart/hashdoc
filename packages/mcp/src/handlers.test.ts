import { describe, expect, it } from 'vitest';
import { decode, payloadFromUrl } from '@portablemd/core';
import { createMarkdownLink, readMarkdownLink, DecodeError } from './handlers.js';

const BASE = 'https://portable.md/';

describe('createMarkdownLink', () => {
  it('produces a url whose fragment decodes back to the input markdown', () => {
    const markdown = '# Hello\n\nSome **bold** text and a list:\n\n- one\n- two\n';
    const { url } = createMarkdownLink({ markdown }, BASE);

    const payload = payloadFromUrl(url);
    expect(payload).not.toBeNull();
    expect(decode(payload as string)).toBe(markdown);
  });

  it('reports characters as the full Link length', () => {
    const result = createMarkdownLink({ markdown: 'hi' }, BASE);
    expect(result.characters).toBe(result.url.length);
  });

  it('honours the provided base URL as the origin', () => {
    const result = createMarkdownLink({ markdown: 'hi' }, BASE);
    expect(result.url.startsWith(`${BASE}#`)).toBe(true);
  });

  it('omits warning for a small Document', () => {
    const result = createMarkdownLink({ markdown: 'small note' }, BASE);
    expect(result.warning).toBeUndefined();
    expect('warning' in result).toBe(false);
  });

  it('sets warning past the size threshold for a large Document', () => {


    let seed = 1;
    let markdown = '';
    for (let i = 0; i < 20_000; i += 1) {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
      markdown += String.fromCharCode(33 + (seed % 94));
    }
    const result = createMarkdownLink({ markdown }, BASE);
    expect(result.characters).toBeGreaterThanOrEqual(8_000);
    expect(result.warning).toBeTypeOf('string');
  });
});

describe('readMarkdownLink', () => {
  it('round-trips a full Link URL', () => {
    const markdown = '## Round trip\n\nbody text';
    const { url } = createMarkdownLink({ markdown }, BASE);
    expect(readMarkdownLink({ url }).markdown).toBe(markdown);
  });

  it('round-trips a bare Payload (no fragment)', () => {
    const markdown = 'bare payload document';
    const { url } = createMarkdownLink({ markdown }, BASE);
    const payload = payloadFromUrl(url) as string;
    expect(readMarkdownLink({ url: payload }).markdown).toBe(markdown);
  });

  it('throws a typed DecodeError on corrupt / garbage input', () => {
    expect(() => readMarkdownLink({ url: 'https://portable.md/#not-a-real-payload!!!' })).toThrow(
      DecodeError,
    );
    expect(() => readMarkdownLink({ url: 'total garbage' })).toThrow(DecodeError);
  });
});
