import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  createMarkdownLink,
  readMarkdownLink,
  DecodeError,
} from './handlers.js';

export const DEFAULT_BASE_URL = 'https://hashdoc.ghost7.org/';

export function resolveBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env.HASHDOC_BASE_URL?.trim();
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

export function createServer(baseUrl: string = resolveBaseUrl()): McpServer {
  const server = new McpServer({
    name: 'HashDoc',
    version: '0.0.0',
  });

  server.registerTool(
    'create_markdown_link',
    {
      title: 'Create an HashDoc Link',
      description:
        'Compress markdown into a shareable Link whose entire content lives in the URL fragment. Nothing is sent to any server.',
      inputSchema: {
        markdown: z.string().describe('The markdown document to encode into a Link.'),
        password: z
          .string()
          .optional()
          .describe(
            'Optional password. When provided, the Link is encrypted; the password is never embedded in the Link and must be conveyed to the reader out-of-band.',
          ),
      },
    },
    async (args) => jsonResult(await createMarkdownLink(args, baseUrl)),
  );

  server.registerTool(
    'read_markdown_link',
    {
      title: 'Read an HashDoc Link',
      description:
        'Recover the markdown from an HashDoc Link. Accepts either a full Link URL or a bare Payload.',
      inputSchema: {
        url: z
          .string()
          .describe('A full HashDoc Link URL, or a bare Payload from a Link fragment.'),
        password: z
          .string()
          .optional()
          .describe(
            'Optional password for protected Links. The password is never embedded in the Link and must be conveyed out-of-band.',
          ),
      },
    },
    async (args) => {
      try {
        return jsonResult(await readMarkdownLink(args));
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
