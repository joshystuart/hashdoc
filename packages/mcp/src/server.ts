import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  createMarkdownLink,
  readMarkdownLink,
  DecodeError,
} from './handlers.js';

export const DEFAULT_BASE_URL = 'https://openartifact.md/';

export function resolveBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env.OPENARTIFACT_BASE_URL?.trim();
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
    name: 'openartifact',
    version: '0.0.0',
  });

  server.registerTool(
    'create_markdown_link',
    {
      title: 'Create an openartifact Link',
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
      title: 'Read an openartifact Link',
      description:
        'Recover the markdown from an openartifact Link. Accepts either a full Link URL or a bare Payload.',
      inputSchema: {
        url: z
          .string()
          .describe('A full openartifact Link URL, or a bare Payload from a Link fragment.'),
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
