# Editor protect toggle (web create path)

> **Status:** ✅ Done — completed 2026-06-20

## Parent

[Password-protected (encrypted) Links PRD](./PRD.md)

## What to build

The author experience for creating a protected (tag `2`) Link in the Editor,
reusing the existing `mountEditor` / `Editor` seam.

Add a **"Protect with password"** toggle:

- **Off (default):** behavior is byte-for-byte identical to today — synchronous
  v1 `encode`, a `1…` Link. The common case stays one-click and instant.
- **On:** show password and confirm inputs plus explanatory copy stating that the
  password must be shared **separately** from the Link and that a lost password
  means the Document is **unrecoverable**. "Copy Link" and "View" become async
  (await `encodeProtected`) and produce a `2…` Link.

The live preview continues to render the in-memory markdown locally regardless of
protection state (no encryption needed to preview). The character/size indicator
reflects the protected Link length (post-encryption, post-base64) when protection
is on, so size warnings stay accurate.

Messaging: protected surfaces may legitimately use security language
("password-protected", "encrypted"). The unprotected path must continue to make
no security claims — scope the existing "never says secure" guardrail to the
unprotected state rather than removing it.

## Acceptance criteria

- [x] With protection off, "Copy Link" produces a `1…` Link and all existing
      Editor tests pass unchanged.
- [x] A "Protect with password" toggle reveals password + confirm inputs and
      threat-model copy (share password separately; unrecoverable if lost).
- [x] With protection on and a password set, "Copy Link" produces a `2…` Link
      that `decodeProtected` reverses back to the typed markdown with that
      password.
- [x] "View" with protection on opens the protected Link through the Viewer
      (which then prompts for the password).
- [x] The size/character indicator reflects the protected Link length when
      protection is on.
- [x] Live preview renders without a password in both states.
- [x] The "never says secure" guardrail still holds for the unprotected state;
      the protected state is allowed to use security language.

## Blocked by

- 01 — Core v2 encryption format
