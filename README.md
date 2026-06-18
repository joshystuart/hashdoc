# portablemd

Share beautifully-rendered markdown as a single link. The entire Document is
compressed into the URL **fragment**, so opening a link reconstructs and renders
it client-side — **no server ever receives or stores the content**. Nothing to
install, no account, no tracking.

- **People** create links by pasting markdown into the **Editor** and copying the link.
- **Agents** create links directly through the **MCP** server.
- **Recipients** open the link, read the rendered Document, and can fork-and-edit it into their own new link.

See [CONTEXT.md](CONTEXT.md) for the glossary and [docs/prds/portablemd-v1/PRD.md](docs/prds/portablemd-v1/PRD.md) for the full spec.

## Repository layout

A pnpm + TypeScript monorepo with three packages:

| Package | What it is |
|---|---|
| [`packages/core`](packages/core) | The Link **format only** — `encode`/`decode`, version-tag handling, link/size helpers. No DOM, no rendering. Single source of truth shared by `web` and `mcp`. The v1 format is **frozen** ([FORMAT.md](packages/core/FORMAT.md)). |
| [`packages/web`](packages/web) | The Viewer + Editor + shared render module (Vite, Preact, CodeMirror). |
| [`packages/mcp`](packages/mcp) | The MCP server exposing two tools over stdio. |

## Prerequisites

- **Node.js** ≥ 20 (developed on 24)
- **pnpm** (this repo pins `pnpm@10` via `packageManager`; install with `corepack enable`)

## Install

```bash
pnpm install
```

Root scripts fan out to every workspace:

```bash
pnpm build      # build all packages
pnpm test       # run all tests
pnpm typecheck  # type-check all packages
```

> Note: `web` type-checks against `core`'s built output, so run `pnpm build`
> before a cold `pnpm typecheck` (or just run `pnpm build` first).

---

## Running the website

### Development (live reload)

```bash
pnpm dev
```

This starts the Vite dev server for `@portablemd/web` at **http://localhost:5173**.

- Open the bare URL → the **Editor** loads with a self-describing example. Paste your
  markdown, then click **Copy Link** to get a shareable link.
- Open a URL with a fragment (`http://localhost:5173/#<payload>`) → the **Viewer**
  renders that Document.

### Production build / preview

```bash
pnpm --filter @portablemd/web build      # outputs packages/web/dist
pnpm --filter @portablemd/web preview     # serves the built dist locally
```

The build is fully static and origin-relative (`base: './'`), so `packages/web/dist`
can be dropped onto **any static host** with zero configuration — no serverless
functions, no backend. Everything (fonts, highlight.js, Mermaid, KaTeX) is bundled
and self-hosted; the app makes **zero third-party requests**.

---

## Running the MCP server

The MCP server is pure-local and makes **zero network calls**. It speaks **stdio**
and exposes two tools:

| Tool | Input | Result |
|---|---|---|
| `create_markdown_link` | `{ markdown }` | `{ url, characters, warning? }` |
| `read_markdown_link` | `{ url }` (full link **or** bare payload) | `{ markdown }` |

There is no `update` tool — editing is just another `create` (fork-and-share has no identity).

### Build it first

```bash
pnpm --filter @portablemd/mcp build
```

This emits the runnable entry at `packages/mcp/dist/bin.js`.

### Configure the link origin

Set `PORTABLEMD_BASE_URL` to the origin that produced links should point at.
If unset, it defaults to `http://localhost:5173/` (handy for local testing
against the dev server above).

```bash
export PORTABLEMD_BASE_URL="https://your-portablemd-domain/"
```

### Run / register it

The binary is `portablemd-mcp` (entry: `packages/mcp/dist/bin.js`). Point your MCP
client at it. Example client config:

```json
{
  "mcpServers": {
    "portablemd": {
      "command": "node",
      "args": ["/absolute/path/to/portablemd/packages/mcp/dist/bin.js"],
      "env": {
        "PORTABLEMD_BASE_URL": "https://your-portablemd-domain/"
      }
    }
  }
}
```

To run it directly (it then waits for an MCP client to talk to it over stdio):

```bash
PORTABLEMD_BASE_URL="https://your-portablemd-domain/" node packages/mcp/dist/bin.js
```

> Once published to npm, the intended distribution is `npx @portablemd/mcp`. While
> developing from this repo, run the built `bin.js` directly as shown above.

---

## Privacy & safety

- The Document lives in the URL **fragment**, which browsers never transmit to a
  server (not in requests, not in `Referer`). ([ADR 0001](docs/adr/0001-the-link-is-the-document.md))
- **Zero third-party requests** — no analytics, no CDN; everything bundled. ([ADR 0002](docs/adr/0002-no-third-party-requests.md))
- Rendering is sanitized through DOMPurify with a strict CSP as defense-in-depth.
- Links are **bearer-access**: anyone with the link can read it. A link is never "secure."
