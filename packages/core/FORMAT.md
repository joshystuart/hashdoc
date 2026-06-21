# The v1 Link format is FROZEN

`@hashdoc/core` owns the Link format and is the single source of truth for
`encode`/`decode`. As of issue-15, **version 1 of the format is frozen.**

HashDoc's product promise is that **the Link IS the document, and a Link made
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

## The v2 format — secure Links (FROZEN)

Version 2 (tag `2`) is the **secure** Link format. It is additive: v1
is untouched and remains the default for plain sharing. v2 reuses v1's
compression and codec and inserts an encryption step (compress-then-encrypt, so
the incompressible ciphertext does not bloat the Link).

```
markdown
  -> UTF-8 bytes
  -> raw DEFLATE            (fflate `deflateSync` — identical to v1)
  -> AES-256-GCM encrypt    (key derived from the password)
  -> binary frame
  -> base64url              (no padding — existing codec)
  -> prefix version tag `2`
```

`encodeSecure(markdown, password)` returns the `2…` Payload;
`decodeSecure(payload, password)` reverses it. `isSecure(payload)` is a
cheap synchronous `payload[0] === '2'` check. v2 is **async** because Web Crypto
is Promise-based; v1 stays synchronous.

### Binary frame layout

All fields are non-secret and travel in the Payload. The password is **never**
stored in the Link.

```
[ salt: 16 bytes ] [ iterations: uint32 big-endian ] [ iv: 12 bytes ] [ ciphertext + 16-byte GCM tag ]
```

The minimum valid frame is 48 bytes (32-byte header + 16-byte GCM tag for
empty ciphertext). Anything shorter is a `malformed-encrypted-frame`.

### Crypto parameters

- **KDF:** PBKDF2-HMAC-SHA-256, **600,000 iterations**, 32-byte (256-bit) key.
  The iteration count is stored in the frame so the cost is self-describing and
  can be raised later without a third version tag.
- **Cipher:** AES-256-GCM, random 12-byte IV per encryption, 16-byte auth tag.
- **Randomness:** `crypto.getRandomValues` for the salt and IV.
- All primitives are native Web Crypto (`crypto.subtle`) — **zero runtime
  dependencies, no WASM**.

A wrong password (or any tampering) fails the GCM tag check and surfaces as the
`wrong-password` error reason — there is no separate stored password verifier.

### What "frozen" means for v2

Because encryption is **non-deterministic** (random salt and IV every time), the
encode direction cannot be pinned the way v1's golden fixtures pin
`encode(markdown)`. The permanence guarantee is therefore enforced on the
**decode direction**: [`src/crypto.test.ts`](./src/crypto.test.ts) hardcodes a
literal `2…` Payload plus its known password and asserts it always decrypts back
to a known Document. A secure Link shared today must keep opening with its
password forever.

## Evolving the format

Any future change to compression or encoding must ship under a **NEW version
tag** (e.g. `3`), routed through `decode`'s version dispatch. You must **never**
mutate the v1 or v2 encoding or re-capture the frozen literals to "make the test
pass."

The freeze is tied to fflate's DEFLATE output, which is deterministic for a
given input and library version (currently fflate `0.8.x`). A future fflate
change that altered its output would (correctly) break the golden tests. That
is a **format change**, not a test to repair: introduce a new version tag and
leave v1 untouched, so the billions of `1`-tagged Links already in the wild keep
opening forever.
