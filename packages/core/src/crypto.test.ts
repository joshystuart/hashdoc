import { describe, expect, it } from 'vitest';
import { decode } from './codec.js';
import { decodeProtected, encodeProtected, isProtected, VERSION_TAG_V2 } from './crypto.js';
import { classifyDecodeError, DecodeError } from './errors.js';
import { base64urlToBytes, bytesToBase64url } from './base64url.js';

const PASSWORD = 'correct horse battery staple';

const CONTENT_VARIETY: readonly { name: string; markdown: string }[] = [
  { name: 'empty string', markdown: '' },
  { name: 'simple ASCII heading', markdown: '# Hello' },
  { name: 'unicode + multi-byte + emoji', markdown: 'héllo 世界 🌍' },
  {
    name: 'GFM table',
    markdown: '| Name | Qty |\n| --- | --- |\n| Apple | 3 |\n| Pear | 5 |\n',
  },
  {
    name: 'fenced code block',
    markdown: '```ts\nconst answer: number = 42;\nconsole.log(answer);\n```\n',
  },
  { name: 'CRLF line endings', markdown: 'line one\r\nline two\r\n' },
  {
    name: 'longer multi-construct document',
    markdown:
      '# Title\n\nA paragraph with **bold**, _italic_, and `code`.\n\n- one\n- two\n- three\n\n> A blockquote.\n\n[A link](https://example.com)\n',
  },
];

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DecodeError);
    return (error as DecodeError).reason;
  }
  throw new Error('expected promise to reject');
}

describe('v2 protected round-trip across the content variety', () => {
  for (const { name, markdown } of CONTENT_VARIETY) {
    it(`round-trips: ${name}`, async () => {
      const payload = await encodeProtected(markdown, PASSWORD);
      expect(payload.startsWith(VERSION_TAG_V2)).toBe(true);
      expect(await decodeProtected(payload, PASSWORD)).toBe(markdown);
    });
  }
});

describe('v2 encryption is non-deterministic', () => {
  it('encrypting the same input twice yields different Payloads that both decrypt', async () => {
    const markdown = '# Same input, different ciphertext';
    const a = await encodeProtected(markdown, PASSWORD);
    const b = await encodeProtected(markdown, PASSWORD);
    expect(a).not.toBe(b);
    expect(await decodeProtected(a, PASSWORD)).toBe(markdown);
    expect(await decodeProtected(b, PASSWORD)).toBe(markdown);
  });
});

describe('v2 authentication and integrity', () => {
  it('wrong password rejects with reason wrong-password', async () => {
    const payload = await encodeProtected('secret content', PASSWORD);
    expect(await reasonOf(decodeProtected(payload, 'not the password'))).toBe('wrong-password');
  });

  it('tampering with a frame byte rejects with wrong-password (never a silent wrong decrypt)', async () => {
    const payload = await encodeProtected('secret content', PASSWORD);
    const frame = base64urlToBytes(payload.slice(1));
    const last = frame.length - 1;
    frame[last] = frame[last]! ^ 0xff;
    const tampered = VERSION_TAG_V2 + bytesToBase64url(frame);
    expect(await reasonOf(decodeProtected(tampered, PASSWORD))).toBe('wrong-password');
  });

  it('truncated/too-short frame rejects with malformed-encrypted-frame and classifies as corrupt', async () => {
    const payload = await encodeProtected('secret content', PASSWORD);
    const frame = base64urlToBytes(payload.slice(1)).subarray(0, 10);
    const truncated = VERSION_TAG_V2 + bytesToBase64url(frame);

    let caught: DecodeError | undefined;
    try {
      await decodeProtected(truncated, PASSWORD);
    } catch (error) {
      caught = error as DecodeError;
    }
    expect(caught?.reason).toBe('malformed-encrypted-frame');
    expect(classifyDecodeError(caught!)).toBe('corrupt');
  });
});

describe('isProtected distinguishes schemes', () => {
  it('returns true for a 2… Payload and false for a 1… Payload', async () => {
    const protectedPayload = await encodeProtected('# Locked', PASSWORD);
    expect(isProtected(protectedPayload)).toBe(true);
    expect(isProtected('1U1bwSM3JyQcA')).toBe(false);
    expect(isProtected('')).toBe(false);
  });
});

describe('cross-scheme guards', () => {
  it('sync decode on a 2… Payload throws password-required directing to decodeProtected', async () => {
    const payload = await encodeProtected('# Locked', PASSWORD);
    try {
      decode(payload);
      throw new Error('expected decode to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DecodeError);
      expect((error as DecodeError).reason).toBe('password-required');
      expect((error as DecodeError).message).toMatch(/decodeProtected/);
    }
  });

  it('decodeProtected on a 1… Payload throws a clear typed error', async () => {
    expect(await reasonOf(decodeProtected('1U1bwSM3JyQcA', PASSWORD))).toBe('unsupported-version');
  });

  it('decodeProtected on a 2… Payload with an empty password throws password-required', async () => {
    const payload = await encodeProtected('# Locked', PASSWORD);
    expect(await reasonOf(decodeProtected(payload, ''))).toBe('password-required');
  });
});

describe('classifyDecodeError maps the new wrong-password kind', () => {
  it('classifies wrong-password as the wrong-password kind', () => {
    const error = new DecodeError('wrong-password', 'nope');
    expect(classifyDecodeError(error)).toBe('wrong-password');
  });

  it('still classifies structural failures as corrupt', () => {
    expect(classifyDecodeError(new DecodeError('malformed-encrypted-frame', 'x'))).toBe('corrupt');
  });
});

describe('v2 permanence freeze — a pinned Payload must decrypt forever (decode direction)', () => {
  const FROZEN_DOC = '# Protected\n\nThe **password** is required. 世界 🌍\n';
  const FROZEN_PASSWORD = 'correct horse battery staple';
  const FROZEN_PAYLOAD =
    '2iJhgCFuNr-Q1SLdl8ziiIAAJJ8AecHa61ASUJwrjL5n2DCAcRi9whTGhaWK9NZWzHSVP94vacuttFumjGZ8VBRwiilxMDxNQu_pJyxvQBjgIklQa6ew8jOIJFOsNj1zurAv2yUDh284nqg';

  it('frozen Payload begins with the v2 version tag "2"', () => {
    expect(FROZEN_PAYLOAD.startsWith(VERSION_TAG_V2)).toBe(true);
  });

  it('frozen Payload decrypts to the known Document with the known password', async () => {
    expect(await decodeProtected(FROZEN_PAYLOAD, FROZEN_PASSWORD)).toBe(FROZEN_DOC);
  });

  it('frozen Payload rejects the wrong password', async () => {
    expect(await reasonOf(decodeProtected(FROZEN_PAYLOAD, 'wrong'))).toBe('wrong-password');
  });
});
