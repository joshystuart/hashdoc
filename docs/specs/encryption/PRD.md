# PRD: Password-protected (encrypted) Links

## Problem Statement

Today every HashDoc Link is **bearer access**: anyone who has the Link can read
the Document. The whole Document lives, compressed but unencrypted, in the URL
fragment (format v1, tag `1`). That is exactly the right default for casual
sharing, but it means a Link is only as private as the channel it travels
through. If a Link is forwarded, pasted into the wrong chat, leaked from
someone's history, or shared somewhere public, the Document is fully exposed —
there is no second factor protecting it.

People want to share some Documents more widely (over the internet, in places
they don't fully trust) while keeping the contents readable only by people they
choose. There is currently no way to do that without standing up a backend,
which ADR 0001 ("the link is the document") deliberately refuses.

## Solution

Add an **optional** second sharing scheme: a Link whose Document is encrypted
with a password the author chooses. The author shares the Link as usual, but
sends the password through a separate channel. Anyone who opens the Link is
prompted for the password; only with the correct password does the Document
decrypt and render.

Crucially, this is **additive and opt-in**:

- An unprotected Link is unchanged — still tag `1`, no password, opens
  instantly. This remains the default.
- A protected Link is a new format version, tag `2`: the same DEFLATE-compressed
  bytes, then encrypted client-side with a key derived from the password (salt +
  AES-GCM), then base64url-encoded into the fragment behind the `2` tag.

The password is **never** placed in the Link. The Link still contains everything
needed to *attempt* decryption (the random salt and IV), but not the secret, so
the Link alone is useless without the out-of-band password. Encryption happens
entirely in the browser via the native Web Crypto API — no backend (ADR 0001
preserved) and no third-party code or requests (ADR 0002 preserved).

This gives a genuine, honest "some level of security": confidentiality against
anyone who holds the Link but not the password, with the understood limitation
that a weak password is brute-forceable offline by someone who has the Link.

## User Stories

1. As an author, I want to optionally protect a Document with a password, so
   that I can share its Link more widely without exposing the contents to
   everyone who sees the Link.
2. As an author, I want unprotected sharing to remain the default and completely
   unchanged, so that the common case stays one-click and instant.
3. As an author, I want to turn on protection with a clear toggle in the Editor,
   so that I consciously choose encryption rather than getting it by accident.
4. As an author, when I enable protection, I want to type (and confirm) a
   password, so that I don't lock a Document with a typo I can't recover from.
5. As an author, I want the Editor to clearly tell me to share the password
   separately from the Link, so that I don't defeat the purpose by sending both
   together.
6. As an author, I want "Copy Link" to produce an encrypted (tag `2`) Link when
   protection is on, so that the shared artifact is actually the protected one.
7. As an author, I want to preview my Document locally while composing, even with
   protection enabled, so that encryption doesn't get in the way of authoring.
8. As an author, I want to be warned that a forgotten password means the Document
   is permanently unrecoverable, so that I understand there is no reset.
9. As an author, I want the size indicator to account for the encryption
   overhead, so that I'm not surprised when a protected Link is a bit longer.
10. As a reader, when I open a protected Link, I want to be prompted for a
    password instead of seeing an error, so that I understand the Document is
    locked, not broken.
11. As a reader, I want a wrong password to produce a clear "incorrect password"
    message (distinct from "corrupt Link"), so that I know to re-check the
    password rather than assume the Link is broken.
12. As a reader, I want the correct password to decrypt and render the Document
    exactly like any other Document, so that protection is invisible once I'm in.
13. As a reader, I want a truncated/corrupt protected Link to still report a
    corruption error, so that I can tell "wrong password" apart from "bad Link".
14. As a reader opening a protected Link made by a newer/unknown version, I want
    the existing "needs a newer HashDoc" message, so that version handling stays
    consistent.
15. As a reader who has unlocked a protected Document, I want the same reading
    niceties (copy source, copy link, edit, heading anchors, print), so that the
    Viewer experience is consistent across schemes.
16. As a reader who unlocked a Document, when I use "Copy Link", I want it to
    copy the original protected Link, so that I re-share the protected form, not
    an accidentally-downgraded plaintext Link.
17. As an author who opens their own protected Link and clicks Edit, I want to
    fork the decrypted Document into the Editor, so that I can revise it (and
    re-protect the new snapshot if I choose).
18. As an AI agent using the MCP, I want to optionally pass a password when
    creating a Link, so that I can produce protected Links programmatically.
19. As an AI agent using the MCP, I want to optionally pass a password when
    reading a Link, so that I can decrypt a protected Link I was given the
    password for.
20. As an AI agent, when I read a protected Link without a password (or with the
    wrong one), I want a clear, typed error telling me a password is required or
    incorrect, so that I can react appropriately.
21. As any holder of an old v1 Link, I want it to keep opening forever exactly as
    before, so that the durability promise (FORMAT.md freeze) is never broken by
    this feature.
22. As a privacy-conscious user, I want the password and decrypted Document to
    never leave my browser, so that the no-backend / no-third-party guarantees
    still hold for protected Links.
23. As a user, I want the encryption to use standard, well-understood primitives
    available natively in the browser, so that protected Links remain decodable
    far into the future without proprietary dependencies.
24. As a user, I want a protected Document I share today to still open with the
    right password years from now, so that v2 inherits the same permanence
    guarantee as v1.

## Implementation Decisions

### Format: a new frozen version, tag `2`

- v1 (tag `1`) is **frozen and untouched** (FORMAT.md). Protected Links are a new
  version, tag `2`, dispatched in `decode` by the leading tag character — exactly
  the evolution path FORMAT.md prescribes.
- The v2 pipeline reuses v1's compression and codec, inserting an encryption step:

  ```
  markdown
    -> UTF-8 bytes
    -> raw DEFLATE            (fflate deflateSync — identical to v1)
    -> AES-256-GCM encrypt    (key derived from password)
    -> binary frame
    -> base64url (no padding) (existing codec)
    -> prefix version tag "2"
  ```

- **Binary frame layout** (all non-secret, stored in the Payload):

  ```
  [ salt: 16 bytes ] [ iterations: uint32 big-endian ] [ iv: 12 bytes ] [ ciphertext + 16-byte GCM tag ]
  ```

  Storing `iterations` makes the KDF cost self-describing, so it can be raised
  later without a third version tag.

- **Crypto primitives** (all via native Web Crypto `crypto.subtle`, zero new
  runtime dependencies, no WASM):
  - Key derivation: **PBKDF2-HMAC-SHA-256**, **600,000 iterations**, 32-byte key.
  - Cipher: **AES-256-GCM**, random 12-byte IV per encryption, 16-byte auth tag.
  - Randomness: `crypto.getRandomValues` for salt and IV.
  - Authenticated encryption means a wrong password (or any tampering) fails the
    GCM tag check — this is how "incorrect password" is detected, with no
    separate password verifier to store.
- **Compress-then-encrypt** (not the reverse): ciphertext is incompressible, so
  encrypting first would bloat Links; compressing first keeps protected Links
  close to v1 size plus a fixed ~44-byte (pre-base64) header overhead.

### Core module (`@hashdoc/core`) — the single primary seam

- Add async functions alongside the existing sync v1 API (which stays sync and
  frozen):
  - `encodeProtected(markdown, password): Promise<string>` → returns a `2…`
    Payload.
  - `decodeProtected(payload, password): Promise<string>` → returns the markdown,
    or throws a typed `DecodeError`.
  - `isProtected(payload): boolean` → `payload[0] === '2'`. A cheap, synchronous
    check so callers can branch (e.g. decide whether to prompt for a password)
    without attempting decryption.
- `VERSION_TAG_V2 = '2'` exported as a sibling to `VERSION_TAG_V1`.
- `decode` (the existing sync function) must reject a `2` Payload with a clear,
  typed error directing callers to the protected path — it must not silently
  mis-handle it.
- **Errors:** extend `DecodeErrorReason` with at least:
  - `wrong-password` — GCM authentication failed (incorrect password or tampered
    ciphertext that still parsed structurally).
  - `password-required` — a `2` Payload was handed to a path with no password.
  - `malformed-encrypted-frame` — the decoded frame is too short / structurally
    invalid (distinct from a valid frame that fails to decrypt).
  - Extend `classifyDecodeError` so the UI can distinguish a new
    `wrong-password` kind from the existing `corrupt` / `unknown-version` kinds.
    A structurally-corrupt protected Link (e.g. truncated) still classifies as
    `corrupt`.

### Web Viewer (reuse existing seam: `resolveView` / `mountViewer`)

- Extend the `ViewerState` union with a synchronous, non-error state:
  `{ kind: 'locked'; payload: string }`. `resolveView` detects a protected
  Payload via `isProtected` and returns `locked` **synchronously** — keeping the
  existing sync seam and its tests intact. No decryption happens during resolve.
- `mountViewer` renders a **password prompt** for the `locked` state. On submit,
  it calls `decodeProtected(payload, password)` (async):
  - Success → transition to the existing `document` state and render exactly as
    today (same chrome, enhancement, title, anchors).
  - `wrong-password` → keep the prompt visible with an inline "incorrect
    password" message; allow retry.
  - structural corruption → fall through to the existing corrupt-Link error view.
- Once unlocked, the Viewer chrome's **"Copy Link" re-emits the original
  protected Link** (it must not re-encode the now-plaintext markdown into a `1`
  Link). "Copy source" still copies the decrypted markdown. "Edit" forks the
  decrypted markdown into the Editor (existing fork behavior).

### Web Editor (reuse existing seam: `mountEditor` / `Editor`)

- Add a **"Protect with password"** toggle. When off, behavior is byte-for-byte
  identical to today (sync v1 `encode`, `1…` Link).
- When on: show password + confirm inputs and explanatory copy that the password
  must be shared separately and is unrecoverable if lost. "Copy Link" / "View"
  become async (await `encodeProtected`).
- Live preview continues to render the in-memory markdown locally regardless of
  protection state (no need to encrypt to preview).
- Size/character indicator reflects the protected Link length (post-encryption,
  post-base64) when protection is on, so warnings stay accurate.

### MCP (reuse existing seam: handlers + tool schemas)

- `create_markdown_link`: add an optional `password` input. When present, produce
  a `2…` Link via `encodeProtected`; otherwise unchanged. The result shape
  (`url`, `characters`, optional `warning`) is preserved.
- `read_markdown_link`: add an optional `password` input. When the Payload is
  protected, decrypt with the supplied password; if none is supplied, return the
  typed `password-required` error; if wrong, return `wrong-password`. Unprotected
  Links are unchanged.
- Handlers become async; tool registrations already support async handlers.

### Messaging / honesty

- Protected Links may legitimately use security language ("password-protected",
  "encrypted") in their own UI surfaces. Unprotected Links must continue to make
  **no** security claims (they are bearer access) — preserving the spirit of the
  current "never says secure" guardrails for the v1 path.
- The Editor must clearly state the threat model in plain terms: the password is
  not in the Link; share it separately; a lost password means the Document is
  unrecoverable; a weak password can be brute-forced by someone who has the Link.

## Testing Decisions

Good tests here assert **external, observable behavior** — given a password and a
Link, does the right Document (or the right typed error) come out — never the
internal byte layout of the frame or which Web Crypto calls were made. The one
exception is the deliberate freeze fixtures, which pin externally-promised
permanence (a specific protected Payload + password must always decrypt to a
specific Document), mirroring the existing v1 golden approach.

- **Core codec (primary seam) — new `crypto.test.ts`:**
  - Round-trip: `decodeProtected(encodeProtected(md, pw), pw) === md` across the
    same content variety as the v1 golden fixtures (empty, ASCII, unicode/emoji,
    GFM table, fenced code, CRLF, long multi-construct).
  - Non-determinism: encrypting the same input twice yields **different**
    Payloads (random salt/IV) yet both decrypt back to the original — contrast
    with v1's determinism assertion.
  - Wrong password → throws `DecodeError` with reason `wrong-password`.
  - Tampered ciphertext (flip a byte in the frame) → `wrong-password` (GCM auth
    failure), not a silent wrong decryption.
  - Truncated/short frame → `malformed-encrypted-frame` (structural), classified
    as `corrupt`.
  - `isProtected` correctly distinguishes `1…` vs `2…` Payloads.
  - Cross-scheme guards: sync `decode` on a `2…` Payload throws a clear typed
    error; `decodeProtected` on a `1…` Payload throws a clear typed error.
  - **Permanence freeze (`golden`-style):** a hardcoded v2 Payload + known
    password decrypts to a known Document, asserted forever. This is the
    decode-direction permanence guarantee (analogous to `golden.test.ts`); the
    encode direction cannot be pinned because salt/IV are random, so freeze is
    enforced on decode only.
  - Error classification: `classifyDecodeError` maps `wrong-password` to the new
    UI kind and leaves structural failures as `corrupt`.

- **Web Viewer (`viewer.test.ts`, existing seam):**
  - A protected Link routes `resolveView` to `kind: 'locked'` synchronously (not
    `error`, not `document`).
  - `mountViewer` renders a password prompt for a locked Link.
  - Submitting the correct password renders the Document (assert rendered HTML,
    title, chrome) and runs no scripts (reuse the existing XSS-safety assertions
    on decrypted content).
  - Wrong password keeps the prompt and shows an "incorrect password" message;
    the Document is not rendered.
  - A truncated protected Link still shows the corrupt-Link error view.
  - After unlock, "Copy Link" copies a Link that is still protected (starts with
    `2` Payload) and decrypts back to the same Document with the password;
    "Copy source" copies the decrypted markdown; "Edit" forks the decrypted
    markdown.
  - Prior art: existing `resolveView`/`mountViewer` routing, decode-failure, and
    "Copy Link round-trips" tests in `viewer.test.ts`.

- **Web Editor (`editor.test.ts`, existing seam):**
  - Protection off: produces a `1…` Link (current tests must continue to pass
    unchanged).
  - Protection on with a password: "Copy Link" produces a `2…` Link that
    `decodeProtected` reverses back to the typed markdown with that password.
  - The "never says secure" guardrail still holds for the **unprotected** path;
    the protected path is allowed to use security language (update/expand the
    existing guardrail test to scope it to the unprotected state).
  - Live preview renders without a password.
  - Prior art: existing "Copy Link produces a Link that decodes back" and
    "type → Copy Link → re-open renders" tests.

- **MCP (`handlers.test.ts` / `server.test.ts`, existing seam):**
  - `create_markdown_link` with a `password` returns a protected Link that
    `read_markdown_link` + same password reverses to the original markdown.
  - `create_markdown_link` without a `password` is unchanged (tag `1`).
  - `read_markdown_link` on a protected Link with no password →
    `password-required` typed error result; with a wrong password →
    `wrong-password` typed error result.
  - Prior art: existing handler round-trip and `DecodeError`-to-error-result
    tests.

- **No-third-party guard (`no-third-party.test.ts`):** the encryption path adds
  no network requests and no new external dependency; the existing bundle audit
  must still pass.

## Out of Scope

- **Changing or re-encoding v1.** v1 stays frozen; unprotected Links are
  untouched.
- **A backend, key escrow, accounts, or password recovery/reset.** A lost
  password means an unrecoverable Document, by design (ADR 0001 — no backend).
- **Per-recipient keys, public-key sharing, or access revocation.** This is a
  single shared symmetric password, not a key-management system. A shared
  password cannot be revoked after the fact.
- **Argon2id or other non-native KDFs.** PBKDF2 via Web Crypto is the chosen v2
  KDF (native, dependency-free, durable). A stronger KDF would be a future,
  separate version tag, weighed against the bundled-WASM cost vs ADR 0002 /
  permanence.
- **Hiding metadata that is inherently exposed:** approximate Document size (Link
  length) and the fact that a Link is protected (the `2` tag) remain observable.
- **Rich link previews / unfurling** for protected Links (already impossible per
  ADR 0001, and meaningless for encrypted content).
- **Rotating or strengthening the iteration count for already-shared Links.**
  Existing protected Links keep the parameters baked into their frame.

## Further Notes

- **Threat model (state plainly in author-facing copy):** v2 provides
  confidentiality against anyone who has the Link but not the password. Because
  the ciphertext travels in the Link, an attacker who has the Link can attempt an
  **offline** brute-force; resistance is therefore bounded by password strength
  and the KDF cost (600k PBKDF2 iterations). Encourage long passphrases. This is
  "meaningful security for a chosen-strength password," not absolute secrecy.
- **Why native Web Crypto:** PBKDF2 + AES-GCM are stable, ubiquitous web
  standards with no dependency and no WASM, which protects both ADR 0002 (no
  third-party code) and the FORMAT.md permanence promise (no library-version
  drift that could break old Links — contrast with the fflate-version caveat
  already noted for v1).
- **Async ripple:** v1 stays synchronous; v2 is inherently async (Web Crypto is
  Promise-based). The Viewer absorbs this cleanly by resolving to a synchronous
  `locked` state first and only awaiting decryption on password submit, so the
  existing sync `resolveView` seam and its tests are preserved.
- **Permanence verification:** because encrypted output is non-deterministic, the
  v2 freeze is enforced on the **decode** direction (a pinned Payload+password →
  Document), which is the actual user-facing permanence guarantee.
- This PRD was requested to be written to `docs/specs/encryption/PRD.md` rather
  than published to the issue tracker; the `ready-for-agent` triage step from the
  skill was intentionally skipped in favor of the file output.
