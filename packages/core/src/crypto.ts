import { deflateSync, inflateSync } from 'fflate';
import { base64urlToBytes, bytesToBase64url } from './base64url.js';
import { DecodeError } from './errors.js';
import { VERSION_TAG_V1, VERSION_TAG_V2 } from './versions.js';

export { VERSION_TAG_V2 };

const SALT_BYTES = 16;
const ITERATIONS_BYTES = 4;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const KEY_BITS = 256;
const PBKDF2_ITERATIONS = 600_000;

const HEADER_BYTES = SALT_BYTES + ITERATIONS_BYTES + IV_BYTES;
const MIN_FRAME_BYTES = HEADER_BYTES + GCM_TAG_BYTES;

const MAX_COMPRESSED_BYTES = 512 * 1024;
const MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024;

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function isSecure(payload: string): boolean {
  return payload[0] === VERSION_TAG_V2;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(utf8Encoder.encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encodeSecure(markdown: string, password: string): Promise<string> {
  const compressed = deflateSync(utf8Encoder.encode(markdown));

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed));

  const frame = new Uint8Array(HEADER_BYTES + ciphertext.length);
  frame.set(salt, 0);
  new DataView(frame.buffer).setUint32(SALT_BYTES, PBKDF2_ITERATIONS, false);
  frame.set(iv, SALT_BYTES + ITERATIONS_BYTES);
  frame.set(ciphertext, HEADER_BYTES);

  return VERSION_TAG_V2 + bytesToBase64url(frame);
}

export async function decodeSecure(payload: string, password: string): Promise<string> {
  if (payload.length === 0) {
    throw new DecodeError('empty-payload', 'Payload is empty.');
  }

  const tag = payload[0]!;

  if (tag === VERSION_TAG_V1) {
    throw new DecodeError(
      'unsupported-version',
      'This is a plain v1 Link. Use decode(payload) to open it.',
    );
  }

  if (tag !== VERSION_TAG_V2) {
    throw new DecodeError(
      'unsupported-version',
      `Unsupported Link version tag "${tag}". This Link was created by a newer or unknown version of HashDoc.`,
    );
  }

  if (password.length === 0) {
    throw new DecodeError(
      'password-required',
      'This Link is secure. A password is required to open it.',
    );
  }

  let frame: Uint8Array;
  try {
    frame = base64urlToBytes(payload.slice(1));
  } catch (cause) {
    throw new DecodeError('malformed-base64', 'Payload is not valid base64url.', { cause });
  }

  if (frame.length < MIN_FRAME_BYTES) {
    throw new DecodeError(
      'malformed-encrypted-frame',
      'Encrypted Link is truncated or structurally invalid.',
    );
  }

  if (frame.length > MAX_COMPRESSED_BYTES) {
    throw new DecodeError('too-large', 'Payload is too large to decode safely.');
  }

  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const salt = frame.subarray(0, SALT_BYTES);
  const iterations = view.getUint32(SALT_BYTES, false);
  const iv = frame.subarray(SALT_BYTES + ITERATIONS_BYTES, HEADER_BYTES);
  const ciphertext = frame.subarray(HEADER_BYTES);

  const key = await deriveKey(password, salt, iterations);

  let compressed: Uint8Array;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(ciphertext)),
    );
  } catch (cause) {
    throw new DecodeError(
      'wrong-password',
      'Incorrect password, or this secure Link has been tampered with.',
      { cause },
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed, { out: new Uint8Array(MAX_DECOMPRESSED_BYTES + 1) });
  } catch (cause) {
    throw new DecodeError('corrupt-deflate', 'Payload data is corrupt or truncated.', { cause });
  }

  if (bytes.length > MAX_DECOMPRESSED_BYTES) {
    throw new DecodeError('too-large', 'Decoded Document exceeds the maximum supported size.');
  }

  try {
    return utf8Decoder.decode(bytes);
  } catch (cause) {
    throw new DecodeError('invalid-utf8', 'Decoded Document is not valid UTF-8.', { cause });
  }
}
