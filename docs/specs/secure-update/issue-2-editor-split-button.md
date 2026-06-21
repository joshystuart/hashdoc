# Editor secure split button

## What to build

Replace the Editor's inline "Protect with password" checkbox with a shared
**Split Button** that folds securing a Document into the copy control, plus the
**Password Dialog** it opens. This delivers the full author-side feature
end-to-end.

Behavior:

- **No password set:** the primary segment copies the plain Link (one click,
  unchanged from today); the caret menu offers "Copy secure link".
- **Choosing "Copy secure link" with no password:** opens the Password Dialog —
  a native `<dialog>` with a single password field, a show/hide reveal toggle,
  and the "share the password separately / lost = unrecoverable" safety note. Its
  submit button reads "Copy secure link" and, on submit, saves the session
  password, copies the Secure Link, and closes in one step. Submit is disabled
  while the field is empty.
- **Password set:** the primary segment becomes "Copy secure link" with a
  closed-lock icon and copies the Secure Link immediately using the remembered
  session password (no dialog). The caret menu now offers "Copy Link" (plain),
  "Change password…" (reopens the dialog; submit just saves, no copy), and
  "Remove password" (clears the session password and reverts the primary to the
  plain copy, no confirmation).

The inline checkbox, password, and confirm inputs and the inline note are
removed; their state collapses into the single session password plus the dialog.
The Secure Link is precomputed whenever a password is set so the primary copy
writes to the clipboard within the click gesture; the first-time flow
encrypts-then-writes inside the dialog submit handler's gesture. The
size/character indicator reflects whichever Link the primary action would copy.
The split button and dialog carry their accessibility contract (caret
`aria-haspopup`/`aria-expanded`, keyboard menu nav, Escape and click-outside to
dismiss, dialog focus trap and focus restoration). Only the secure surfaces use
security language; the plain copy stays honestly unprotected.

## Acceptance criteria

- [ ] `SplitButton` and `PasswordDialog` exist as the shared chrome primitives and
      the Editor's inline protect section is gone.
- [ ] With no password, the primary copies a plain (tag `1`) Link unchanged.
- [ ] Choosing the secure menu item opens the dialog; submitting a non-empty
      password copies a Secure (tag `2`) Link that decodes back to the typed
      Document with that password, sets the lock, and closes the dialog.
- [ ] With a password set, the primary copies the Secure Link without reopening
      the dialog.
- [ ] "Change password…" yields a Secure Link decryptable with the new password
      but not the old; "Remove password" reverts to the plain primary and plain
      Link.
- [ ] Submit is disabled on an empty password; live preview works regardless of
      protection; size indicator reflects the active Link.
- [ ] Dialog and menu are keyboard- and screen-reader-operable (focus trap,
      Escape, click-outside, focus restoration).
- [ ] The "never says secure" guardrail still holds for the plain path.
- [ ] Editor tests cover the above at the existing Editor seam; verified in a real
      browser via the Chrome DevTools MCP (light and dark themes).

## Blocked by

- issue-1-secure-rename.md
