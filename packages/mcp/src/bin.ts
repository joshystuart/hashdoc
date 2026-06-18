#!/usr/bin/env node
/**
 * Runnable stdio entry point for the portablemd MCP server.
 *
 * `npx @portablemd/mcp` lands here. The base URL is read from
 * `PORTABLEMD_BASE_URL` at startup (default `http://localhost:5173/`).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // Never crash silently; report on stderr (stdout is the MCP channel).
  console.error('portablemd MCP server failed to start:', error);
  process.exit(1);
});
