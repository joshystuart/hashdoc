/**
 * @portablemd/mcp — placeholder.
 *
 * The MCP server (create + read Links) is implemented in a later issue. This
 * stub exists so the workspace is wired into the monorepo and depends only on
 * `@portablemd/core` (the shared Link format), keeping the package tiny.
 */
import { encode, decode } from '@portablemd/core';

export const MCP_PLACEHOLDER = true;

// Re-export the format so the eventual server has a single import surface.
export { encode, decode };
