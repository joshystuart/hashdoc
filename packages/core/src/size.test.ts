import { describe, expect, it } from 'vitest';
import { linkSizeWarning } from './size.js';

describe('linkSizeWarning', () => {
  it('returns undefined for short Links', () => {
    expect(linkSizeWarning(0)).toBeUndefined();
    expect(linkSizeWarning(100)).toBeUndefined();
    expect(linkSizeWarning(7_999)).toBeUndefined();
  });

  it('warns for long Links', () => {
    expect(linkSizeWarning(8_000)).toBeTypeOf('string');
    expect(linkSizeWarning(10_000)).toMatch(/long/i);
  });

  it('warns more strongly for very long Links', () => {
    const msg = linkSizeWarning(20_000);
    expect(msg).toBeTypeOf('string');
    expect(msg).toMatch(/very long|truncat/i);
  });
});
