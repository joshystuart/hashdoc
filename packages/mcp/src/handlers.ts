/**
 * Pure, directly-callable tool-handler logic for the portablemd MCP server.
 *
 * These functions do nothing but string math over `@portablemd/core` — no
 * network, no filesystem, no globals. The MCP server (see `server.ts`) wires
 * them into tool registrations, and tests call them directly as the highest
 * seam below spinning up a real stdio client.
 */
import {
  encode,
  decode,
  buildLink,
  payloadFromUrl,
  linkSizeWarning,
  DecodeError,
} from '@portablemd/core';

/** Result of {@link createMarkdownLink}. */
export interface CreateMarkdownLinkResult {
  /** The full Link, with the Payload in the fragment. */
  url: string;
  /** Total character length of the Link. */
  characters: number;
  /** Size warning, present only when the Link is long enough to warrant one. */
  warning?: string;
}

/** Result of {@link readMarkdownLink}. */
export interface ReadMarkdownLinkResult {
  /** The Document recovered from the Link's Payload. */
  markdown: string;
}

/**
 * Build a Link from markdown.
 *
 * `baseUrl` is taken as a parameter (rather than read from the environment)
 * so callers and tests stay pure and can override the origin without mutating
 * `process.env`.
 */
export function createMarkdownLink(
  args: { markdown: string },
  baseUrl: string,
): CreateMarkdownLinkResult {
  const url = buildLink(encode(args.markdown), baseUrl);
  const characters = url.length;
  const warning = linkSizeWarning(characters);
  // Omit `warning` entirely when undefined (exactOptionalPropertyTypes).
  return warning === undefined ? { url, characters } : { url, characters, warning };
}

/**
 * Recover the markdown from a Link.
 *
 * Accepts either a full Link (a URL with a fragment) or a bare Payload. If
 * {@link payloadFromUrl} finds no fragment, the input itself is treated as a
 * bare Payload before decoding.
 *
 * Throws {@link DecodeError} on corrupt / truncated / unknown-version input;
 * the server layer turns that into a graceful MCP tool error.
 */
export function readMarkdownLink(args: { url: string }): ReadMarkdownLinkResult {
  const payload = payloadFromUrl(args.url) ?? args.url;
  return { markdown: decode(payload) };
}

export { DecodeError };
