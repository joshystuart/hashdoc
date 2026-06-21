# Core v2 encryption format (`@hashdoc/core`)

> **Status:** ✅ Done — completed 2026-06-20

## Parent

[Secure (encrypted) Links PRD](./PRD.md)

## What to build

The foundational, frozen **tag `2`** Link format in `@hashdoc/core`: the single
seam every other slice builds on. v1 (tag `1`) stays frozen and untouched.

Add async, password-based encryption alongside the existing sync v1 API:

- `encodeSecure(markdown, password): Promise<string>` → a `2…` Payload.
- `decodeSecure(payload, password): Promise<string>` → the markdown, or a
  typed `DecodeError`.
- `isSecure(payload): boolean` → cheap synchronous `payload[0] === '2'` check
  so callers can branch (e.g. prompt for a password) without attempting
  decryption.
- `VERSION_TAG_V2 = '2'` exported alongside `VERSION_TAG_V1`.

The v2 pipeline reuses v1's compression and codec, inserting encryption:

```
markdown
  -> UTF-8 bytes
  -> raw DEFLATE            (fflate deflateSync — identical to v1)
  -> AES-256-GCM encrypt    (key derived from password)
  -> binary frame
  -> base64url (no padding) (existing codec)
  -> prefix version tag "2"
```

Binary frame layout (all non-secret, stored in the Payload). This shape encodes
the format decision precisely:

```
[ salt: 16 bytes ] [ iterations: uint32 big-endian ] [ iv: 12 bytes ] [ ciphertext + 16-byte GCM tag ]
```

Crypto primitives — all via native Web Crypto `crypto.subtle`, **zero new runtime
dependencies, no WASM**:

- Key derivation: PBKDF2-HMAC-SHA-256, 600,000 iterations, 32-byte key.
- Cipher: AES-256-GCM, random 12-byte IV per encryption, 16-byte auth tag.
- Randomness: `crypto.getRandomValues` for salt and IV.
- Compress-then-encrypt (not the reverse) to keep secure Links small.

Error handling: extend `DecodeErrorReason` with `wrong-password` (GCM auth
failure — covers both incorrect password and tampered ciphertext that still
parses), `password-required` (a `2` Payload reached a path with no password), and
`malformed-encrypted-frame` (structurally invalid/too-short frame). Extend
`classifyDecodeError` so the UI can distinguish a new `wrong-password` kind while
structural failures still classify as `corrupt`. The existing sync `decode` must
reject a `2` Payload with a clear typed error rather than mis-handling it, and
`decodeSecure` must reject a `1` Payload with a clear typed error.

Documentation: update `packages/core/FORMAT.md` to document the (now frozen) v2
format and its evolution rules, and add a new ADR covering password encryption
and the threat model (offline brute-force bounded by password strength + KDF
cost; password never in the Link; no backend / no third-party preserved).

## Acceptance criteria

- [x] `encodeSecure` / `decodeSecure` / `isSecure` and `VERSION_TAG_V2`
      are exported from `@hashdoc/core`; v1 `encode`/`decode` remain synchronous
      and unchanged (existing v1 golden tests still pass).
- [x] Round-trip holds across the v1 golden content variety (empty, ASCII,
      unicode/emoji, GFM table, fenced code, CRLF, long multi-construct):
      `decodeSecure(encodeSecure(md, pw), pw) === md`.
- [x] Encrypting the same input twice yields **different** Payloads (random
      salt/IV) and both decrypt back to the original.
- [x] Wrong password throws `DecodeError` with reason `wrong-password`.
- [x] Tampering with any byte of the frame yields `wrong-password`, never a
      silent wrong decryption.
- [x] A truncated/too-short frame yields `malformed-encrypted-frame` and is
      classified as `corrupt`.
- [x] `isSecure` correctly distinguishes `1…` from `2…` Payloads.
- [x] Sync `decode` on a `2…` Payload throws a clear typed error;
      `decodeSecure` on a `1…` Payload throws a clear typed error.
- [x] A pinned freeze fixture (hardcoded v2 Payload + known password) decrypts to
      a known Document and is asserted to keep doing so forever (decode-direction
      permanence, mirroring `golden.test.ts`).
- [x] `classifyDecodeError` maps `wrong-password` to the new UI kind and leaves
      structural failures as `corrupt`.
- [x] `FORMAT.md` documents the frozen v2 format; a new ADR records the decision
      and threat model.
- [x] The no-third-party bundle audit still passes (no new dependency, no network
      request).

## Blocked by

- None - can start immediately.
