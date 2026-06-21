# Rename "protected" → "secure" (prefactor)

## What to build

A language-only rename so the whole password-encryption feature area uses the
single word **"secure"** (the format-v2 scheme previously called "protected"),
across code, docs, and UI prose. This is the prefactor that lets the split-button
work land as "the easy change": new components and copy can use "secure" naming
from the start instead of being renamed afterwards.

Scope of the rename:

- `@hashdoc/core`: the secure encode/decode functions and the secure predicate,
  plus the wording of the "password required" / wrong-password error reasoning
  where it surfaces to callers.
- Web package: the `protectedPayload` prop and any "protected"-flavoured
  identifiers/labels.
- MCP package: identifiers only — the create/read tool contract and behavior are
  unchanged.
- Docs prose: `FORMAT.md`, ADR 0003, and `docs/specs/encryption/`.

This is **not** a format change. The `2` version tag, the binary frame layout,
and the cryptographic parameters (PBKDF2-HMAC-SHA-256 600k + AES-256-GCM) are
untouched, so every existing Secure Link keeps decrypting and the golden/freeze
fixtures are unchanged.

## Acceptance criteria

- [ ] Core, web, and MCP source use "secure" consistently for the v2 scheme; no
      "protected" identifiers remain for it.
- [ ] `FORMAT.md`, ADR 0003, and `docs/specs/encryption/` prose use "secure".
- [ ] The `2` version tag, binary frame, and crypto parameters are unchanged.
- [ ] All existing tests pass under the renamed identifiers, including the
      decode-direction permanence/golden fixtures.
- [ ] The no-third-party bundle audit still passes (no new dependency or request).
- [ ] App behavior is observably identical to before the rename.

## Blocked by

- None — can start immediately.
