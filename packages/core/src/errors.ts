export type DecodeErrorReason =
  | 'unsupported-version'
  | 'empty-payload'
  | 'malformed-base64'
  | 'corrupt-deflate'
  | 'too-large'
  | 'invalid-utf8';

export class DecodeError extends Error {
  readonly reason: DecodeErrorReason;

  constructor(reason: DecodeErrorReason, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DecodeError';
    this.reason = reason;
    Object.setPrototypeOf(this, DecodeError.prototype);
  }
}

export type DecodeErrorKind = 'unknown-version' | 'corrupt';

export function classifyDecodeError(error: DecodeError): DecodeErrorKind {
  return error.reason === 'unsupported-version' ? 'unknown-version' : 'corrupt';
}
