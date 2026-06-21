import { describe, expect, it } from 'vitest';
import { decode, payloadFromUrl, isSecure } from '@hashdoc/core';
import { createMarkdownLink, readMarkdownLink, DecodeError } from './handlers.js';

const BASE = 'https://hashdoc.ghost7.org/';

describe('createMarkdownLink', () => {
  it('produces a url whose fragment decodes back to the input markdown', async () => {
    const markdown = '# Hello\n\nSome **bold** text and a list:\n\n- one\n- two\n';
    const { url } = await createMarkdownLink({ markdown }, BASE);

    const payload = payloadFromUrl(url);
    expect(payload).not.toBeNull();
    expect(decode(payload as string)).toBe(markdown);
  });

  it('reports characters as the full Link length', async () => {
    const result = await createMarkdownLink({ markdown: 'hi' }, BASE);
    expect(result.characters).toBe(result.url.length);
  });

  it('honours the provided base URL as the origin', async () => {
    const result = await createMarkdownLink({ markdown: 'hi' }, BASE);
    expect(result.url.startsWith(`${BASE}#`)).toBe(true);
  });

  it('omits warning for a small Document', async () => {
    const result = await createMarkdownLink({ markdown: 'small note' }, BASE);
    expect(result.warning).toBeUndefined();
    expect('warning' in result).toBe(false);
  });

  it('sets warning past the size threshold for a large Document', async () => {


    let seed = 1;
    let markdown = '';
    for (let i = 0; i < 20_000; i += 1) {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
      markdown += String.fromCharCode(33 + (seed % 94));
    }
    const result = await createMarkdownLink({ markdown }, BASE);
    expect(result.characters).toBeGreaterThanOrEqual(8_000);
    expect(result.warning).toBeTypeOf('string');
  });

  it('produces an plain tag 1 Link when no password is given', async () => {
    const { url } = await createMarkdownLink({ markdown: 'plain' }, BASE);
    const payload = payloadFromUrl(url) as string;
    expect(payload[0]).toBe('1');
    expect(isSecure(payload)).toBe(false);
  });

  it('produces a secure tag 2 Link when a password is given', async () => {
    const { url } = await createMarkdownLink({ markdown: 'secret', password: 'hunter2' }, BASE);
    const payload = payloadFromUrl(url) as string;
    expect(payload[0]).toBe('2');
    expect(isSecure(payload)).toBe(true);
  });
});

describe('readMarkdownLink', () => {
  it('round-trips a full Link URL', async () => {
    const markdown = '## Round trip\n\nbody text';
    const { url } = await createMarkdownLink({ markdown }, BASE);
    expect((await readMarkdownLink({ url })).markdown).toBe(markdown);
  });

  it('round-trips a bare Payload (no fragment)', async () => {
    const markdown = 'bare payload document';
    const { url } = await createMarkdownLink({ markdown }, BASE);
    const payload = payloadFromUrl(url) as string;
    expect((await readMarkdownLink({ url: payload })).markdown).toBe(markdown);
  });

  it('throws a typed DecodeError on corrupt / garbage input', async () => {
    await expect(
      readMarkdownLink({ url: 'https://hashdoc.ghost7.org/#not-a-real-payload!!!' }),
    ).rejects.toThrow(DecodeError);
    await expect(readMarkdownLink({ url: 'total garbage' })).rejects.toThrow(DecodeError);
  });

  it('round-trips a secure Link with the same password', async () => {
    const markdown = '# Top secret\n\nclassified body';
    const password = 'correct horse battery staple';
    const { url } = await createMarkdownLink({ markdown, password }, BASE);
    expect((await readMarkdownLink({ url, password })).markdown).toBe(markdown);
  });

  it('throws password-required for a secure Link with no password', async () => {
    const { url } = await createMarkdownLink({ markdown: 'guarded', password: 'pw' }, BASE);
    await expect(readMarkdownLink({ url })).rejects.toMatchObject({
      reason: 'password-required',
    });
    await expect(readMarkdownLink({ url })).rejects.toThrow(DecodeError);
  });

  it('throws wrong-password for a secure Link with the wrong password', async () => {
    const { url } = await createMarkdownLink({ markdown: 'guarded', password: 'right' }, BASE);
    await expect(readMarkdownLink({ url, password: 'nope' })).rejects.toMatchObject({
      reason: 'wrong-password',
    });
    await expect(readMarkdownLink({ url, password: 'nope' })).rejects.toThrow(DecodeError);
  });
});
