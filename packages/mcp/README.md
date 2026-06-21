# @hashdoc/mcp

HashDoc MCP server for creating and reading HashDoc Links over stdio.

HashDoc Links store markdown in the URL fragment after `#`. The MCP server runs locally, makes no network calls, and uses `@hashdoc/core` to encode, decode, encrypt, and decrypt documents.

## Use With An MCP Client

```json
{
  "mcpServers": {
    "HashDoc": {
      "command": "npx",
      "args": ["-y", "@hashdoc/mcp"],
      "env": {
        "HASHDOC_BASE_URL": "https://hashdoc.dev/"
      }
    }
  }
}
```

`HASHDOC_BASE_URL` controls the origin used when the server creates Links. If it is unset, the server uses `https://hashdoc.dev/`.

## Tools

### `create_markdown_link`

Creates a HashDoc Link from markdown.

Input:

```json
{
  "markdown": "# Hello HashDoc"
}
```

Optional secure Link input:

```json
{
  "markdown": "# Private note",
  "password": "correct horse battery staple"
}
```

Result:

```json
{
  "url": "https://hashdoc.dev/#1...",
  "characters": 123
}
```

Long Links may also return `warning`.

### `read_markdown_link`

Reads markdown from a full HashDoc Link URL or a bare payload.

Input:

```json
{
  "url": "https://hashdoc.dev/#1..."
}
```

Secure Links require the same password used when the Link was created:

```json
{
  "url": "https://hashdoc.dev/#2...",
  "password": "correct horse battery staple"
}
```

Result:

```json
{
  "markdown": "# Hello HashDoc"
}
```

## Install

```bash
npm install @hashdoc/mcp
```

The package exposes a `hashdoc-mcp` binary:

```bash
HASHDOC_BASE_URL="https://hashdoc.dev/" npx -y @hashdoc/mcp
```

It also exports helpers for embedding or testing the server:

```ts
import {
  DEFAULT_BASE_URL,
  createMarkdownLink,
  createServer,
  readMarkdownLink,
  resolveBaseUrl,
} from '@hashdoc/mcp';
```

## Exports

- `createServer(baseUrl)` creates the MCP server.
- `resolveBaseUrl(env)` resolves `HASHDOC_BASE_URL` with the production default.
- `DEFAULT_BASE_URL` is `https://hashdoc.dev/`.
- `createMarkdownLink(args, baseUrl)` creates a Link without starting MCP transport.
- `readMarkdownLink(args)` reads a Link without starting MCP transport.
