/**
 * The portablemd MCP server.
 *
 * Exposes exactly two pure-local tools — `create_markdown_link` and
 * `read_markdown_link` — over stdio. All encode/decode + size logic comes from
 * `@portablemd/core`; this layer only wires the pure handlers (see
 * `handlers.ts`) into MCP tool registrations and renders results / errors.
 *
 * Zero network: the only imports are the MCP SDK, zod, and `@portablemd/core`.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  createMarkdownLink,
  readMarkdownLink,
  DecodeError,
} from './handlers.js';

/** Origin used when building Links if `PORTABLEMD_BASE_URL` is unset. */
export const DEFAULT_BASE_URL = 'http://localhost:5173/';

/** Read the configured base URL from the environment, falling back to local dev. */
export function resolveBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env.PORTABLEMD_BASE_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_BASE_URL;
}

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

/**
 * Build an {@link McpServer} with the two tools registered against `baseUrl`.
 *
 * Separated from transport wiring so the registrations can be exercised
 * without a stdio subprocess.
 */
export function createServer(baseUrl: string = resolveBaseUrl()): McpServer {
  const server = new McpServer({
    name: 'portablemd',
    version: '0.0.0',
  });

  server.registerTool(
    'create_markdown_link',
    {
      title: 'Create a portablemd Link',
      description:
        'Compress markdown into a shareable Link whose entire content lives in the URL fragment. Nothing is sent to any server.',
      inputSchema: {
        markdown: z.string().describe('The markdown document to encode into a Link.'),
      },
    },
    (args) => jsonResult(createMarkdownLink(args, baseUrl)),
  );

  server.registerTool(
    'read_markdown_link',
    {
      title: 'Read a portablemd Link',
      description:
        'Recover the markdown from a portablemd Link. Accepts either a full Link URL or a bare Payload.',
      inputSchema: {
        url: z
          .string()
          .describe('A full portablemd Link URL, or a bare Payload from a Link fragment.'),
      },
    },
    (args) => {
      try {
        return jsonResult(readMarkdownLink(args));
      } catch (error) {
        if (error instanceof DecodeError) {
          return errorResult(`Could not read this Link (${error.reason}): ${error.message}`);
        }
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`Could not read this Link: ${message}`);
      }
    },
  );

  return server;
}
