# MCP protected create/read

## Parent

[Password-protected (encrypted) Links PRD](./PRD.md)

## What to build

Programmatic create/read of protected (tag `2`) Links over the MCP, reusing the
existing `createMarkdownLink` / `readMarkdownLink` handlers and tool schemas.

- `create_markdown_link`: add an optional `password` input. When present, produce
  a `2…` Link via `encodeProtected`; otherwise behavior is unchanged. The result
  shape (`url`, `characters`, optional `warning`) is preserved.
- `read_markdown_link`: add an optional `password` input. When the Payload is
  protected, decrypt with the supplied password; if none is supplied, return the
  typed `password-required` error result; if wrong, return `wrong-password`.
  Unprotected Links are unchanged.

Handlers become async; tool registrations already support async handlers. Tool
descriptions should briefly note that the password is never embedded in the Link
and must be conveyed out-of-band.

## Acceptance criteria

- [ ] `create_markdown_link` with a `password` returns a protected Link that
      `read_markdown_link` + the same password reverses to the original markdown.
- [ ] `create_markdown_link` without a `password` is unchanged (tag `1`), with the
      same result shape and size warning behavior.
- [ ] `read_markdown_link` on a protected Link with no password returns a typed
      `password-required` error result.
- [ ] `read_markdown_link` on a protected Link with a wrong password returns a
      typed `wrong-password` error result.
- [ ] `read_markdown_link` on an unprotected Link is unchanged.

## Blocked by

- 01 — Core v2 encryption format
