import { describe, expect, it } from 'vitest';
import { buildLink, payloadFromUrl } from './link.js';

describe('buildLink', () => {
  it('appends the payload as a fragment', () => {
    expect(buildLink('1abc', 'https://md.example/')).toBe('https://md.example/#1abc');
  });

  it('discards an existing fragment', () => {
    expect(buildLink('1new', 'https://md.example/#1old')).toBe('https://md.example/#1new');
  });

  it('discards an existing query string', () => {
    expect(buildLink('1abc', 'https://md.example/path?ref=x')).toBe('https://md.example/path#1abc');
  });

  it('works origin-relative (no host)', () => {
    expect(buildLink('1abc', '/')).toBe('/#1abc');
  });
});

describe('payloadFromUrl', () => {
  it('extracts the fragment payload', () => {
    expect(payloadFromUrl('https://md.example/#1abc')).toBe('1abc');
  });

  it('returns null when there is no fragment', () => {
    expect(payloadFromUrl('https://md.example/')).toBeNull();
  });

  it('returns null for an empty fragment', () => {
    expect(payloadFromUrl('https://md.example/#')).toBeNull();
  });

  it('round-trips with buildLink', () => {
    const link = buildLink('1payload', 'https://md.example/');
    expect(payloadFromUrl(link)).toBe('1payload');
  });
});
