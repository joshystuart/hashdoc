# MCP — create & read Links

> **Status:** ✅ Done — completed 2026-06-18

## Parent

[openartifact v1 — PRD](./PRD.md) · respects [ADR 0001](../../adr/0001-the-link-is-the-document.md)

## What to build

An MCP server so agents create and read Links with no browser and no network.

- New `mcp` package exposing **two tools**, **pure-local (zero network)**, distributed via `npx @openartifact/mcp` over **stdio**.
- All encode/decode + size logic comes from `core`. **No `update` tool** — fork-and-share has no identity, so editing is just another create.
- `OPENARTIFACT_BASE_URL` env var sets the origin used when building Links (defaults to a local dev URL for testing).

Decision shape (tool results, from the design session):

```ts
create_markdown_link({ markdown }): { url, characters, warning? }
read_markdown_link({ url }):        { markdown }
```

## Acceptance criteria

- [x] A stdio server (`npx`-runnable) exposes exactly `create_markdown_link` and `read_markdown_link`.
- [x] `create_markdown_link` returns a `url` whose fragment `decode`s (via `core`) to the input markdown; `characters` is the Link length; `warning` is set past the size threshold.
- [x] The `url` origin honours `OPENARTIFACT_BASE_URL`.
- [x] `read_markdown_link` accepts a full URL or a bare Payload and returns the markdown; corrupt/truncated input fails gracefully (no crash).
- [x] The MCP makes zero network calls.
- [x] Tool-handler tests cover round-trip, base-URL override, warning threshold, and corrupt input.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
