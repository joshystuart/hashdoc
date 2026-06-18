/**
 * Reasons a Payload may fail to decode into a Document.
 */
export type DecodeErrorReason =
  | 'unsupported-version'
  | 'empty-payload'
  | 'malformed-base64'
  | 'corrupt-deflate'
  | 'invalid-utf8';

/**
 * Typed error thrown by {@link decode} when a Payload cannot be turned back
 * into its Document. Always a typed error rather than garbage output, so
 * callers (Viewer, MCP) can surface a clear message.
 */
export class DecodeError extends Error {
  readonly reason: DecodeErrorReason;

  constructor(reason: DecodeErrorReason, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DecodeError';
    this.reason = reason;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, DecodeError.prototype);
  }
}
