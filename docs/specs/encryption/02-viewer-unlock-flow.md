# Viewer unlock flow (web read path)

> **Status:** ✅ Done — completed 2026-06-20

## Parent

[Password-protected (encrypted) Links PRD](./PRD.md)

## What to build

The reader experience for opening a protected (tag `2`) Link in the Viewer,
reusing the existing `resolveView` / `mountViewer` seam and state machine.

Extend `ViewerState` with a synchronous, non-error state. From a prototype, the
state shape that keeps the existing sync seam intact:

```
type ViewerState =
  | { kind: 'document'; html: string; markdown: string }
  | { kind: 'editor' }
  | { kind: 'locked'; payload: string }   // new: protected Link, awaiting password
  | { kind: 'error'; errorKind: DecodeErrorKind };
```

`resolveView` detects a protected Payload via `isProtected` and returns `locked`
**synchronously** — no decryption during resolve, so the existing sync seam and
its tests are preserved.

`mountViewer` renders a **password prompt** for the `locked` state. On submit it
awaits `decodeProtected(payload, password)`:

- Success → transition to the existing `document` state and render exactly as
  today (same chrome, enhancement, tab title, heading anchors, XSS sanitization).
- `wrong-password` → keep the prompt visible with an inline "incorrect password"
  message and allow retry; the Document is not rendered.
- Structural corruption (e.g. truncated Link) → fall through to the existing
  corrupt-Link error view.
- A `2` Link from a newer/unknown format still uses the existing
  "needs a newer HashDoc" path where applicable.

Once unlocked, the Viewer chrome behaves consistently with v1, with one critical
distinction: **"Copy Link" must re-emit the original protected Link** (the `2…`
Payload it opened) — it must not re-encode the now-plaintext markdown into a `1`
Link. "Copy source" copies the decrypted markdown; "Edit" forks the decrypted
markdown into the Editor.

## Acceptance criteria

- [x] A protected Link routes `resolveView` to `kind: 'locked'` synchronously
      (not `error`, not `document`).
- [x] `mountViewer` renders a password prompt for a locked Link.
- [x] Submitting the correct password renders the Document (correct HTML, tab
      title, chrome) and executes no scripts (XSS-safety holds on decrypted
      content).
- [x] A wrong password keeps the prompt and shows an "incorrect password"
      message; the Document is not rendered; retry is possible.
- [x] A truncated/corrupt protected Link shows the existing corrupt-Link error
      view.
- [x] After unlock, "Copy Link" copies a still-protected Link (its Payload starts
      with `2`) that decrypts back to the same Document with the password.
- [x] After unlock, "Copy source" copies the decrypted markdown and "Edit" forks
      the decrypted markdown into the Editor.
- [x] Unprotected (tag `1`) Links open exactly as before — no prompt, no
      behavior change.

## Blocked by

- 01 — Core v2 encryption format
