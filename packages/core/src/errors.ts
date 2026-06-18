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

/**
 * The two user-facing buckets a {@link DecodeError} falls into. Callers (the
 * Viewer, the MCP) surface a different recovery story for each:
 *
 * - `unknown-version`: the Link carries a version tag this build doesn't know.
 *   It was almost certainly made by a *newer* portablemd; the fix is to update.
 * - `corrupt`: the bytes themselves don't decode. By far the most common cause
 *   in the wild is a Link **truncated** when pasted into chat or email, so the
 *   recovery copy should lead with that.
 */
export type DecodeErrorKind = 'unknown-version' | 'corrupt';

/**
 * Classify a {@link DecodeError} into the user-facing bucket that determines
 * which recovery message to show. Keeps the reason-to-bucket mapping in one
 * place so the Viewer and MCP stay in agreement.
 */
export function classifyDecodeError(error: DecodeError): DecodeErrorKind {
  return error.reason === 'unsupported-version' ? 'unknown-version' : 'corrupt';
}
