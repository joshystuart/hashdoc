export { encode, decode, VERSION_TAG_V1 } from './codec.js';
export { encodeSecure, decodeSecure, isSecure, VERSION_TAG_V2 } from './crypto.js';
export { buildLink, payloadFromUrl } from './link.js';
export { linkSizeWarning } from './size.js';
export { DecodeError, classifyDecodeError } from './errors.js';
export type { DecodeErrorReason, DecodeErrorKind } from './errors.js';
