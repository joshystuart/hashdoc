import { deflateSync, inflateSync } from 'fflate';
import { base64urlToBytes, bytesToBase64url } from './base64url.js';
import { DecodeError } from './errors.js';
import { VERSION_TAG_V1, VERSION_TAG_V2 } from './versions.js';

export { VERSION_TAG_V1 };

const MAX_COMPRESSED_BYTES = 512 * 1024;
const MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024;

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function encode(markdown: string): string {
  const bytes = utf8Encoder.encode(markdown);
  const compressed = deflateSync(bytes);
  return VERSION_TAG_V1 + bytesToBase64url(compressed);
}

export function decode(payload: string): string {
  if (payload.length === 0) {
    throw new DecodeError('empty-payload', 'Payload is empty.');
  }

  const tag = payload[0]!;
  const body = payload.slice(1);

  if (tag === VERSION_TAG_V2) {
    throw new DecodeError(
      'password-required',
      'This Link is secure. Use decodeSecure(payload, password) to open it.',
    );
  }

  if (tag !== VERSION_TAG_V1) {
    throw new DecodeError(
      'unsupported-version',
      `Unsupported Link version tag "${tag}". This Link was created by a newer or unknown version of HashDoc.`,
    );
  }

  let compressed: Uint8Array;
  try {
    compressed = base64urlToBytes(body);
  } catch (cause) {
    throw new DecodeError(
      'malformed-base64',
      'Payload is not valid base64url.',
      { cause },
    );
  }

  if (compressed.length > MAX_COMPRESSED_BYTES) {
    throw new DecodeError(
      'too-large',
      'Payload is too large to decode safely.',
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed, {
      out: new Uint8Array(MAX_DECOMPRESSED_BYTES + 1),
    });
  } catch (cause) {
    throw new DecodeError(
      'corrupt-deflate',
      'Payload data is corrupt or truncated.',
      { cause },
    );
  }

  if (bytes.length > MAX_DECOMPRESSED_BYTES) {
    throw new DecodeError(
      'too-large',
      'Decoded Document exceeds the maximum supported size.',
    );
  }

  try {
    return utf8Decoder.decode(bytes);
  } catch (cause) {
    throw new DecodeError(
      'invalid-utf8',
      'Decoded Document is not valid UTF-8.',
      { cause },
    );
  }
}
