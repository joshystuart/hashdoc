# Viewer secure split button

## What to build

Give the Viewer the same Split Button as the Editor, reusing the `SplitButton`
and `PasswordDialog` built in the Editor slice, seeded from how the Document was
opened.

Behavior:

- **Opened a plain Link:** the split button starts with the plain "Copy Link" as
  the primary; the caret menu offers "Copy secure link", which opens the Password
  Dialog and encrypts the in-memory Document (the Viewer holds the plaintext) —
  exactly like the Editor's first-time flow.
- **Opened a Secure Link:** the split button starts **locked**, with "Copy secure
  link" as the primary that re-emits the original Payload byte-for-byte (no
  re-encryption, no password needed); the caret menu offers a plain "Copy Link" of
  the decrypted Document.

"Copy source" and "Edit" are unchanged, and the reader-side unlock prompt is
untouched. Re-sharing a Secure Document never accidentally produces a downgraded
plaintext Link — the plain copy is always a deliberate menu choice.

## Acceptance criteria

- [ ] The Viewer's single "Copy Link" is replaced by the shared `SplitButton`,
      seeded from the opened Document (presence of the original secure Payload).
- [ ] Plain Document: primary copies the plain Link; the secure menu item opens the
      dialog and produces a Secure Link decryptable to the same Document.
- [ ] Secure Document: starts locked; the primary copies a still-secure (tag `2`)
      Link that decrypts back to the same Document with the password, without
      prompting for one; the menu offers a plain copy.
- [ ] "Copy source", "Edit", and the unlock flow are unchanged.
- [ ] Viewer tests cover the above at the existing Viewer seam; verified in a real
      browser via the Chrome DevTools MCP.

## Blocked by

- issue-2-editor-split-button.md
