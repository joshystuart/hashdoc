/**
 * Pure size-warning helper. Given the character length of a Link, returns a
 * human-readable warning when the Link is long enough to risk being truncated
 * where it is pasted (chat clients, address bars), or `undefined` when it is
 * comfortably within limits.
 *
 * Pure and DOM-free so it is shared by the Viewer, Editor, and MCP. The exact
 * copy is intentionally simple here; later issues refine the messaging.
 */

/** Below this, no warning. Common safe ceiling across chat clients. */
const WARN_THRESHOLD = 8_000;
/** Above this, many tools and older browsers start truncating. */
const DANGER_THRESHOLD = 16_000;

export function linkSizeWarning(characters: number): string | undefined {
  if (characters >= DANGER_THRESHOLD) {
    return `This Link is very long (${characters.toLocaleString()} characters) and may be truncated by some apps when shared. Consider shortening the Document.`;
  }
  if (characters >= WARN_THRESHOLD) {
    return `This Link is long (${characters.toLocaleString()} characters); some apps may shorten it when pasted.`;
  }
  return undefined;
}
