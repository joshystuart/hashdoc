export type DecodeErrorReason =
  | 'unsupported-version'
  | 'empty-payload'
  | 'malformed-base64'
  | 'corrupt-deflate'
  | 'too-large'
  | 'invalid-utf8'
  | 'wrong-password'
  | 'password-required'
  | 'malformed-encrypted-frame';

export class DecodeError extends Error {
  readonly reason: DecodeErrorReason;

  constructor(
    reason: DecodeErrorReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DecodeError';
    this.reason = reason;
    Object.setPrototypeOf(this, DecodeError.prototype);
  }
}

export type DecodeErrorKind = 'unknown-version' | 'corrupt' | 'wrong-password';

export function classifyDecodeError(error: DecodeError): DecodeErrorKind {
  if (error.reason === 'unsupported-version') {
    return 'unknown-version';
  }
  if (error.reason === 'wrong-password') {
    return 'wrong-password';
  }
  return 'corrupt';
}
