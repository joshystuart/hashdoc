# Password-protected links

HashDoc adds an optional second sharing scheme: a Link whose Document is encrypted client-side with a password the author chooses (format v2, tag `2`). The compressed bytes are encrypted with AES-256-GCM under a key derived from the password (PBKDF2-HMAC-SHA-256, 600,000 iterations), then base64url-encoded into the URL **fragment** behind the `2` tag. The author shares the Link as usual and sends the password through a separate channel. v1 (tag `1`) stays frozen and remains the default bearer-access scheme.

## Why

Every v1 Link is bearer access: anyone who holds the Link can read the Document. That is the right default for casual sharing, but people also want to share Documents more widely — over channels they don't fully trust — while keeping the contents readable only by chosen recipients. Per ADR 0001 there is no backend to gate access, so the only place a second factor can live is the Link itself: encrypt the payload so the Link alone is useless without an out-of-band password.

## Considered options

- **Where the secret lives.** The password is **never** placed in the Link. The Link carries everything needed to *attempt* decryption (random salt and IV) but not the secret, so a leaked Link exposes nothing without the separately-shared password.
- **Compress-then-encrypt vs encrypt-then-compress.** Chose compress-then-encrypt. Ciphertext is incompressible, so encrypting first would bloat Links; compressing first keeps protected Links close to v1 size plus a fixed ~44-byte (pre-base64) header.
- **KDF + cipher.** Chose PBKDF2-HMAC-SHA-256 (600k iterations) + AES-256-GCM, all via native Web Crypto. Rejected Argon2id and other non-native KDFs: they require bundled WASM, which conflicts with ADR 0002 (no third-party code) and the FORMAT.md permanence promise (no library-version drift that could break old Links). A stronger KDF would be a future, separate version tag. The iteration count is stored in the frame so it can be raised later without a new tag.
- **Authentication.** AES-GCM is authenticated, so a wrong password (or any tampering) fails the tag check. This *is* the "incorrect password" signal — no separate stored password verifier, and no risk of a silent wrong decryption.

## Threat model

- v2 provides **confidentiality against anyone who has the Link but not the password.** Because the ciphertext travels in the Link, an attacker who holds the Link can attempt an **offline** brute-force; resistance is bounded by password strength and the KDF cost (600,000 PBKDF2 iterations). This is meaningful security for a chosen-strength password, not absolute secrecy — long passphrases are encouraged.
- **A lost password means an unrecoverable Document.** There is no backend, no key escrow, and no reset (ADR 0001). This is surfaced to authors in plain terms.
- **Inherently-exposed metadata stays exposed:** the approximate Document size (Link length) and the fact that a Link is protected (the `2` tag) are observable.

## Consequences

- **No new dependency and no new network request.** Encryption uses native `crypto.subtle` only, preserving ADR 0001 (no backend) and ADR 0002 (no third-party code or requests). The bundle audit must continue to pass.
- **v2 is async** (Web Crypto is Promise-based) while v1 stays synchronous. Callers branch up front with the cheap synchronous `isProtected` check and only await decryption when a password is supplied.
- **Permanence is enforced on the decode direction.** Encryption is non-deterministic (random salt/IV), so encode output cannot be pinned; instead a frozen `2…` Payload + password is asserted to decrypt to a known Document forever (see FORMAT.md).
- **Unprotected Links make no security claims.** Only protected surfaces may use security language; v1 bearer Links remain honestly unprotected.
