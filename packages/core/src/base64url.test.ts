import { describe, expect, it } from 'vitest';
import { base64urlToBytes, bytesToBase64url } from './base64url.js';

describe('base64url', () => {
  it('round-trips byte arrays of every length-mod-3', () => {
    for (let len = 0; len < 50; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 11) & 0xff;
      const encoded = bytesToBase64url(bytes);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(base64urlToBytes(encoded))).toEqual(Array.from(bytes));
    }
  });

  it('produces no padding', () => {
    expect(bytesToBase64url(new Uint8Array([1]))).not.toContain('=');
  });

  it('uses url-safe alphabet (- and _, never + or /)', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toMatch(/[+/]/);
  });

  it('throws on invalid characters', () => {
    expect(() => base64urlToBytes('!!!!')).toThrow();
  });
});
