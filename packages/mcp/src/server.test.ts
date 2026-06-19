import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { decode } from '@portablemd/core';
import { createServer, resolveBaseUrl, DEFAULT_BASE_URL } from './server.js';

async function connectedClient(baseUrl?: string): Promise<Client> {
  const server = createServer(baseUrl);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

interface TextResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
}

function parseJsonResult<T>(result: TextResult): T {
  return JSON.parse(result.content[0]!.text) as T;
}

describe('resolveBaseUrl', () => {
  it('falls back to the local dev origin when unset', () => {
    expect(resolveBaseUrl({})).toBe(DEFAULT_BASE_URL);
  });

  it('honours PORTABLEMD_BASE_URL', () => {
    expect(resolveBaseUrl({ PORTABLEMD_BASE_URL: 'https://portable.md/' })).toBe(
      'https://portable.md/',
    );
  });
});

describe('MCP server', () => {
  it('exposes exactly the two expected tools', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['create_markdown_link', 'read_markdown_link']);
  });

  it('create then read round-trips the markdown through the tools', async () => {
    const client = await connectedClient('https://portable.md/');
    const markdown = '# Via tools\n\nround trip body';

    const created = parseJsonResult<{ url: string; characters: number }>(
      (await client.callTool({
        name: 'create_markdown_link',
        arguments: { markdown },
      })) as TextResult,
    );
    expect(created.url.startsWith('https://portable.md/#')).toBe(true);
    expect(created.characters).toBe(created.url.length);

    const read = parseJsonResult<{ markdown: string }>(
      (await client.callTool({
        name: 'read_markdown_link',
        arguments: { url: created.url },
      })) as TextResult,
    );
    expect(read.markdown).toBe(markdown);
  });

  it('surfaces corrupt input as a graceful MCP error, not a crash', async () => {
    const client = await connectedClient();
    const result = (await client.callTool({
      name: 'read_markdown_link',
      arguments: { url: 'https://portable.md/#totally-bogus!!!' },
    })) as TextResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text.length).toBeGreaterThan(0);


    const created = parseJsonResult<{ url: string }>(
      (await client.callTool({
        name: 'create_markdown_link',
        arguments: { markdown: 'still alive' },
      })) as TextResult,
    );
    expect(decode(created.url.slice(created.url.indexOf('#') + 1))).toBe('still alive');
  });
});
