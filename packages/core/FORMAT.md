# The v1 Link format is FROZEN

`@portablemd/core` owns the Link format and is the single source of truth for
`encode`/`decode`. As of issue-15, **version 1 of the format is frozen.**

portablemd's product promise is that **the Link IS the document, and a Link made
today must open forever** (see [ADR 0001 — "the link is the
document"](../../docs/adr/0001-the-link-is-the-document.md)). Durability is the
product, not a nice-to-have.

## The v1 pipeline (fixed)

```
markdown
  -> UTF-8 bytes
  -> raw DEFLATE  (fflate `deflateSync`)
  -> base64url    (no padding)
  -> prefix version tag `1`
```

`encode(markdown)` returns the Payload **including** the leading `1` tag.

## What "frozen" means

- The exact `markdown -> Payload` mapping for v1 must **never change**. It is
  pinned by golden fixtures in [`src/golden.test.ts`](./src/golden.test.ts):
  hardcoded literal Payloads that the suite asserts `encode` still produces.
  If `encode`'s output drifts for any frozen input, CI fails — by design.
- Every v1 Payload begins with the version tag `1`.
- Every frozen Payload must remain decodable back to its original markdown
  (the golden test asserts the round-trip too — this is the real permanence
  guarantee).

## Evolving the format

Any future change to compression or encoding must ship under a **NEW version
tag** (e.g. `2`), routed through `decode`'s version dispatch. You must **never**
mutate the v1 encoding or re-capture the golden literals to "make the test
pass."

The freeze is tied to fflate's DEFLATE output, which is deterministic for a
given input and library version (currently fflate `0.8.x`). A future fflate
change that altered its output would (correctly) break the golden tests. That
is a **format change**, not a test to repair: introduce a new version tag and
leave v1 untouched, so the billions of `1`-tagged Links already in the wild keep
opening forever.
