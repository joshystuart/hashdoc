import { deflateSync, inflateSync } from 'fflate';
import { base64urlToBytes, bytesToBase64url } from './base64url.js';
import { DecodeError } from './errors.js';

/**
 * The 1-character version tag prefixing every v1 Payload.
 *
 * The pipeline is fixed by ADR 0001:
 *   markdown -> UTF-8 bytes -> raw DEFLATE -> base64url (no padding) -> prefix tag.
 * The tag lets the format evolve without breaking Links already in the wild.
 */
export const VERSION_TAG_V1 = '1';

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Encode a Document's markdown into a Payload (the string carried in a Link's
 * fragment, including its leading version tag).
 */
export function encode(markdown: string): string {
  const bytes = utf8Encoder.encode(markdown);
  const compressed = deflateSync(bytes);
  return VERSION_TAG_V1 + bytesToBase64url(compressed);
}

/**
 * Decode a Payload back into its Document's markdown.
 *
 * @throws {DecodeError} on an empty Payload, an unknown version tag, malformed
 *   base64url, corrupt/truncated DEFLATE data, or invalid UTF-8. Never returns
 *   garbage.
 */
export function decode(payload: string): string {
  if (payload.length === 0) {
    throw new DecodeError('empty-payload', 'Payload is empty.');
  }

  const tag = payload[0]!;
  const body = payload.slice(1);

  if (tag !== VERSION_TAG_V1) {
    throw new DecodeError(
      'unsupported-version',
      `Unsupported Link version tag "${tag}". This Link was created by a newer or unknown version of portablemd.`,
    );
  }

  let compressed: Uint8Array;
  try {
    compressed = base64urlToBytes(body);
  } catch (cause) {
    throw new DecodeError('malformed-base64', 'Payload is not valid base64url.', { cause });
  }

  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed);
  } catch (cause) {
    throw new DecodeError('corrupt-deflate', 'Payload data is corrupt or truncated.', { cause });
  }

  try {
    return utf8Decoder.decode(bytes);
  } catch (cause) {
    throw new DecodeError('invalid-utf8', 'Decoded Document is not valid UTF-8.', { cause });
  }
}
