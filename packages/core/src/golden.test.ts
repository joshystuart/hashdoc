import { describe, expect, it } from 'vitest';
import { decode, encode, VERSION_TAG_V1 } from './codec.js';

/**
 * ============================================================================
 * THE v1 LINK FORMAT IS FROZEN.
 * ============================================================================
 *
 * portablemd's product promise is that the Link IS the document, and a Link
 * made today must open forever (ADR 0001 — "the link is the document").
 *
 * The fixtures below pin a representative set of `markdown -> exact v1 Payload`
 * mappings. The expected Payloads are HARDCODED LITERALS, captured once from
 * `encode` and never recomputed in the assertion — recomputing would be
 * circular and could never catch drift. If `encode`'s output for any of these
 * inputs ever changes, this test FAILS, and that is the point: it is a
 * tripwire against silently breaking every Link already in the wild.
 *
 * The v1 pipeline (fixed): markdown -> UTF-8 bytes -> raw DEFLATE (fflate
 * `deflateSync`) -> base64url (no padding) -> prefix version tag `1`.
 *
 * The freeze is tied to fflate's compression output. fflate `deflateSync` is
 * deterministic for a given input and library version (currently fflate
 * 0.8.x). A future fflate change that altered its DEFLATE output would
 * (correctly) break these tests. That is NOT a bug to "fix" by re-capturing
 * the literals — it is a FORMAT CHANGE, and the only permitted response is to
 * ship the new encoding under a NEW version tag (e.g. `2`) routed through
 * `decode`'s version dispatch. The v1 tag `1` and its bytes must NEVER change.
 *
 * Do not edit these literals. Do not add `encode(...)` to the expected side.
 * ============================================================================
 */

interface GoldenFixture {
  /** Human-readable name describing the construct this fixture exercises. */
  readonly name: string;
  /** The exact frozen markdown input. */
  readonly markdown: string;
  /** The exact frozen v1 Payload `encode(markdown)` must produce, forever. */
  readonly payload: string;
}

const GOLDEN_FIXTURES: readonly GoldenFixture[] = [
  {
    name: 'empty string',
    markdown: '',
    payload: '1AwA',
  },
  {
    name: 'simple ASCII heading',
    markdown: '# Hello',
    payload: '1U1bwSM3JyQcA',
  },
  {
    name: 'unicode + multi-byte + emoji',
    markdown: 'héllo 世界 🌍',
    payload: '1yzi8MicnX-HJjmnPp_YofJjf0wsA',
  },
  {
    name: 'GFM table',
    markdown: '| Name | Qty |\n| --- | --- |\n| Apple | 3 |\n| Pear | 5 |\n',
    payload: '1q1HwS8xNVahRCCypVKjhqlHQ1dUF8sAkkOdYUJADkjUG8wJSE4uAHFMgBwA',
  },
  {
    name: 'fenced code block',
    markdown: '```ts\nconst answer: number = 42;\nconsole.log(answer);\n```\n',
    payload: '1S0hIKCnmSs7PKy5RSMwrLk8tslLIK81NSi1SsFUwMbIGS-XnpOrl5KdrQBRoWnMBdXEBAA',
  },
  {
    name: 'inline HTML',
    markdown: '<div class="note">\n  <strong>Heads up.</strong> Inline <em>HTML</em>.\n</div>\n',
    payload:
      '1s0nJLFNIzkksLrZVyssvSVWy41JQsCkuKcrPS7fzSE1MKVYoLdCz0YeKKHjm5WTmpSrYpObaeYT4-tjoAxl6XDb6QGPsuAA',
  },
  {
    name: 'longer multi-construct document',
    markdown:
      '# Title\n\nA paragraph with **bold**, _italic_, and `code`.\n\n- one\n- two\n- three\n\n> A blockquote.\n\n[A link](https://example.com)\n',
    payload:
      '1FcwxDsIwDEDRPaewxAJRaXcGpNyBDaHWTSwS1Y1DMCrHb7q86euf4JGUyRgHBSu-K5YIW9II1s7CwdoOxqTIyY8dYA4weQk09cZcQTI1dZPDWKlt7uBgZvHL5ydKrXo64JSX1zmqlu9tGOiPa2HqvawXswM',
  },
  {
    name: 'trailing newline',
    markdown: 'Last line.\n',
    payload: '180ksLlHIycxL1eMCAA',
  },
  {
    name: 'CRLF line endings',
    markdown: 'line one\r\nline two\r\n',
    payload: '1y8nMS1XIz0vl5QKzSsrzebkA',
  },
];

describe('v1 golden fixtures — the format is FROZEN', () => {
  it('every fixture has a unique name (no accidental duplicates)', () => {
    const names = GOLDEN_FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const fixture of GOLDEN_FIXTURES) {
    describe(fixture.name, () => {
      it('encode(markdown) === frozen v1 Payload (fails CI if the format drifts)', () => {
        expect(encode(fixture.markdown)).toBe(fixture.payload);
      });

      it('frozen Payload begins with the v1 version tag "1"', () => {
        expect(fixture.payload.startsWith(VERSION_TAG_V1)).toBe(true);
      });

      it('frozen Payload round-trips: decode(Payload) === markdown (permanence)', () => {
        expect(decode(fixture.payload)).toBe(fixture.markdown);
      });

      it('encode is deterministic: same input yields the same Payload twice', () => {
        expect(encode(fixture.markdown)).toBe(encode(fixture.markdown));
      });
    });
  }
});
