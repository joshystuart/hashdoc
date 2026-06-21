const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP: Int8Array = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export function bytesToBase64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out +=
      ALPHABET[(n >> 18) & 63] +
      ALPHABET[(n >> 12) & 63] +
      ALPHABET[(n >> 6) & 63] +
      ALPHABET[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i]! << 16;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
  } else if (rem === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out +=
      ALPHABET[(n >> 18) & 63] +
      ALPHABET[(n >> 12) & 63] +
      ALPHABET[(n >> 6) & 63];
  }
  return out;
}

export function base64urlToBytes(input: string): Uint8Array {
  const len = input.length;
  if (len % 4 === 1) {
    throw new Error('invalid base64url length');
  }
  const fullGroups = Math.floor(len / 4);
  const rem = len - fullGroups * 4;
  const outLen = fullGroups * 3 + (rem === 2 ? 1 : rem === 3 ? 2 : 0);
  const out = new Uint8Array(outLen);

  let o = 0;
  let i = 0;
  for (let g = 0; g < fullGroups; g++) {
    const c0 = val(input.charCodeAt(i++));
    const c1 = val(input.charCodeAt(i++));
    const c2 = val(input.charCodeAt(i++));
    const c3 = val(input.charCodeAt(i++));
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out[o++] = (n >> 16) & 0xff;
    out[o++] = (n >> 8) & 0xff;
    out[o++] = n & 0xff;
  }
  if (rem === 2) {
    const c0 = val(input.charCodeAt(i++));
    const c1 = val(input.charCodeAt(i++));
    const n = (c0 << 18) | (c1 << 12);
    out[o++] = (n >> 16) & 0xff;
  } else if (rem === 3) {
    const c0 = val(input.charCodeAt(i++));
    const c1 = val(input.charCodeAt(i++));
    const c2 = val(input.charCodeAt(i++));
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6);
    out[o++] = (n >> 16) & 0xff;
    out[o++] = (n >> 8) & 0xff;
  }
  return out;
}

function val(code: number): number {
  const v = code < 128 ? LOOKUP[code]! : -1;
  if (v < 0) {
    throw new Error('invalid base64url character');
  }
  return v;
}
