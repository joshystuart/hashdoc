/**
 * @portablemd/mcp — public module surface.
 *
 * Re-exports the pure tool handlers and the server factory so they can be
 * imported by tests and embedders. The runnable stdio entry point lives in
 * `bin.ts` (wired via the package `bin` field).
 */
export {
  createMarkdownLink,
  readMarkdownLink,
  type CreateMarkdownLinkResult,
  type ReadMarkdownLinkResult,
} from './handlers.js';
export { createServer, resolveBaseUrl, DEFAULT_BASE_URL } from './server.js';
