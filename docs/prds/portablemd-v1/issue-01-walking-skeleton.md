# Walking skeleton — view a Link

## Parent

[portablemd v1 — PRD](./PRD.md) · respects [ADR 0001](../../adr/0001-the-link-is-the-document.md), [ADR 0002](../../adr/0002-no-third-party-requests.md)

## What to build

The thinnest end-to-end path: open a Link and see its Document rendered, with the monorepo and Link format in place underneath.

- Establish a **pnpm + TypeScript monorepo** with three workspaces — `core`, `web`, `mcp` — and **Vitest** wired up.
- `core` implements the **v1 Link format**: `encode`/`decode` (UTF-8 → raw DEFLATE via `fflate` → base64url no-pad → `1` version tag), plus URL/link helpers and a pure size-warning helper. `core` is **format-only** — no DOM, no rendering — so `mcp` stays lean.
- `web` reads the URL **fragment**, decodes via `core`, renders through a shared `render(markdown) → safeHTML` module (`markdown-it` with `html:true`/`linkify:true` → `DOMPurify`, GFM incl. tables/strikethrough/task-lists), and displays the Document. No fragment → a temporary placeholder (the self-describing example arrives in issue-12).
- Links are built **origin-relative** in `web` (no base-URL config). The Viewer makes **zero third-party requests** (bundle everything).

Decision shape (`core` public API, from the design session):

```ts
encode(markdown: string): string             // fragment payload, incl. version tag
decode(payload: string): string              // throws on corrupt / unknown-version
buildLink(payload: string, baseUrl: string): string
payloadFromUrl(url: string): string | null
linkSizeWarning(characters: number): string | undefined
```

## Acceptance criteria

- [ ] `pnpm install`, `pnpm build`, `pnpm test` work at the root; `core` / `web` / `mcp` workspaces exist.
- [ ] `core` round-trips: for varied markdown (Unicode, code fences, GFM tables, inline HTML, large Documents), `decode(encode(x)) === x`.
- [ ] Opening `/#<payload>` renders the Document as sanitized HTML; GFM tables, strikethrough, and task lists render.
- [ ] A `<script>` or `onerror=` in the markdown does not execute and is stripped from the output.
- [ ] The Viewer issues zero third-party network requests; Links are built origin-relative (no base-URL config in `web`).
- [ ] The Payload carries the `1` version tag.

## Blocked by

None — can start immediately.
