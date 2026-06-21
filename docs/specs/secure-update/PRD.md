# PRD: The secure-link split button

## Problem Statement

Today an author turns on encryption through a "Protect with password" checkbox
that sits on its own row in the Editor, below the action bar. Ticking it reveals
a password field and a confirm field; once they match, the Editor _silently_
swaps what "Copy Link" copies from a plain Link to a Secure Link. This has three
problems from the author's point of view:

- The decision to secure a Document is divorced from the act of copying it. The
  author configures protection in one place and copies in another, and the
  button they actually click gives no sign of which kind of Link it will produce.
- There is no at-a-glance indication of the current state on the control that
  matters. A Document can be secured, but the primary button still just says
  "Copy Link", so it is easy to forget whether the copied Link is encrypted.
- The Viewer has none of this. A reader looking at a Document — secure or plain —
  gets a single "Copy Link" with no way to express "give me the secure version"
  or "give me a plain shareable version", even though the Viewer holds everything
  needed to produce either.

The split between "protected" (used in the format, the core code, and the ADRs)
and any "secure"-flavoured wording in the UI also invites terminology drift,
which the project glossary exists to prevent.

## Solution

Replace the checkbox with a **Split Button** that folds securing a Document into
the copy control itself, shared by both the Editor and the Viewer.

- With no password set, the primary segment copies the plain Link, and the caret
  menu offers "Copy secure link".
- Choosing "Copy secure link" with no password yet opens a **Password Dialog** (a
  native modal). The author types one password (with a show/hide reveal to catch
  typos) and submits; the dialog saves the password, copies the Secure Link, and
  closes in one step.
- Once a password is set, the primary segment _becomes_ "Copy secure link" with a
  closed-lock icon and copies the Secure Link immediately using the remembered
  session password. The caret menu now offers the plain "Copy Link", plus
  "Change password…" and "Remove password".

In the Viewer the same control is seeded from how the Document was opened: a plain
Link starts with the plain primary (and can encrypt the in-memory Document on
demand, exactly like the Editor); a Secure Link starts locked, with the primary
re-emitting the original Payload byte-for-byte and the menu offering a plain copy.

Alongside this, the whole feature area standardises on the single word **"secure"**
(the format-v2 password scheme previously called "protected") across the UI,
code, glossary, `FORMAT.md`, and ADR 0003. This is a language-only change: the
wire format, the binary frame, and the `2` version tag are untouched, so every
existing Secure Link keeps decrypting.

## User Stories

1. As an author, I want a single copy control that can produce either a plain Link
   or a Secure Link, so that securing a Document and copying it are the same act.
2. As an author, I want the common case (copy a plain Link) to stay one click on
   the primary segment, so that casual sharing is unchanged.
3. As an author, I want "Copy secure link" available from a caret menu next to the
   primary copy, so that the secure variant is discoverable without cluttering the
   bar.
4. As an author, when I choose "Copy secure link" with no password set, I want a
   dialog to appear asking for a password, so that I consciously choose the secret.
5. As an author, I want to type my password in a single field with a show/hide
   toggle, so that I can verify there is no typo before committing.
6. As an author, I want submitting the dialog to save the password, copy the
   Secure Link, and close in one step, so that the copy intent I started is
   fulfilled immediately.
7. As an author, once a password is set, I want the primary button to become
   "Copy secure link" with a closed-lock icon, so that the active scheme is visible
   on the button that performs the action.
8. As an author, once a password is set, I want clicking the primary button to copy
   the Secure Link instantly without re-prompting, so that repeat secure copies are
   as fast as plain copies.
9. As an author with a password set, I want the plain "Copy Link" demoted into the
   caret menu, so that producing an unencrypted Link of a secured Document is a
   deliberate choice rather than the default.
10. As an author, I want a "Change password…" item in the menu, so that I can
    replace the secret without removing protection.
11. As an author, I want a "Remove password" item in the menu, so that I can revert
    to plain sharing in one action.
12. As an author, I want "Remove password" to revert immediately without an extra
    confirmation prompt, so that clearing an in-memory secret is friction-free
    (no data is destroyed by it).
13. As an author, I want the Password Dialog to remind me to share the password
    separately from the Link and that a lost password is unrecoverable, so that I
    understand the threat model at the moment I choose the password.
14. As an author, I want the size/character indicator to reflect the Secure Link
    once a password is set, so that I am not surprised that an encrypted Link is
    longer.
15. As an author, I want live preview to keep working regardless of whether a
    password is set, so that securing a Document never gets in the way of writing.
16. As an author, I want editing the Document after setting a password to keep the
    password and re-encrypt the new content, so that the secure copy always matches
    what I am currently writing.
17. As an author, I want the Password Dialog to be dismissable with Escape or by
    clicking the backdrop, so that opening it by mistake costs me nothing.
18. As an author, I want the Password Dialog to trap focus and return focus to the
    button when it closes, so that keyboard and screen-reader use is correct.
19. As an author, I want the caret menu to be operable by keyboard (open, arrow
    through items, Escape to close, click-outside to dismiss), so that the control
    is accessible.
20. As an author, I want the submit action disabled until I have entered a
    non-empty password, so that I cannot create a Secure Link with an empty secret.
21. As a reader viewing a plain Document, I want the same split button, so that I
    can copy either the plain Link or create a Secure Link from what I am reading.
22. As a reader viewing a plain Document, when I choose "Copy secure link", I want
    the Viewer to encrypt the Document it already holds, so that I can re-share it
    securely without re-authoring it.
23. As a reader who opened a Secure Link, I want the split button to start in the
    locked state with "Copy secure link" as the primary, so that the control
    reflects that the Document arrived secured.
24. As a reader who opened a Secure Link, I want "Copy secure link" to re-emit the
    exact original Link, so that I re-share the protected form without an accidental
    downgrade and without needing to know the password.
25. As a reader who opened a Secure Link, I want a plain "Copy Link" still available
    in the menu, so that I can deliberately share a plaintext Link of a Document I
    can already read.
26. As a reader, I want the unlock prompt I see when opening a Secure Link to be
    unchanged by this feature, so that opening a locked Document works exactly as
    before.
27. As any user, I want the unprotected copy to make no security claims, so that a
    plain Link stays honestly bearer-access.
28. As any user, I want one consistent word, "secure", used across the UI, docs,
    and code, so that the feature is described the same way everywhere.
29. As a holder of an existing Secure Link, I want it to keep decrypting after the
    rename, so that the language change never breaks a Link in the wild.
30. As an AI agent using the MCP, I want the create/read tools to behave exactly as
    before, so that the rename and UI change do not alter the programmatic contract
    beyond renamed identifiers.

## Implementation Decisions

### New shared module: Split Button

- A new `SplitButton` joins the existing chrome primitives (`AppHeader`,
  `HeaderButton`) and is consumed by both the Editor and the Viewer — the one
  genuinely-varying UI seam this feature introduces.
- Its interface is small and state-driven: a primary action (label, icon, click
  handler), an ordered list of menu items (label, optional icon, handler,
  destructive flag), and a "locked" flag that selects the closed-lock icon and the
  secure styling on the primary segment.
- The split button owns the menu's open/close behaviour and its accessibility
  contract: `aria-haspopup`/`aria-expanded` on the caret, roving focus through
  items, Escape and click-outside to dismiss, and focus restoration.
- The primary segment and the caret are distinct hit targets; clicking the primary
  runs the primary action directly, clicking the caret toggles the menu.

### New leaf module: Password Dialog

- A `PasswordDialog` is built directly on the native `<dialog>` element (top-layer
  rendering, built-in focus trap, Escape-to-close, `::backdrop`) rather than on a
  generic modal abstraction — there is only one dialog use today.
- Interface: an `open` flag, an optional `initialPassword` (for the change flow), a
  configurable submit label, an `onSubmit(password)` callback, and an `onClose`
  callback. The component holds the in-progress field value and reveal-toggle state
  internally.
- Contents: a single password input with a show/hide reveal toggle, the
  share-separately / unrecoverable-if-lost safety copy, and a submit button that is
  disabled while the field is empty.
- Two invocation modes share the same dialog: the first-time secure-copy flow
  (submit label "Copy secure link"; submit saves + copies + closes) and the change
  flow (submit label "Save"; submit saves + closes, no copy).

### Editor changes (reuse existing Editor seam)

- Remove the inline protect section entirely: the "Protect with password" checkbox,
  the password and confirm inputs, and the inline note. The previous `protect`,
  `password`, and `confirm` pieces collapse into a single session "secure password"
  value plus the dialog's own field state.
- Drive the split button from that session password: absent → primary plain copy,
  menu offers secure copy; present → primary secure copy (locked), menu offers
  plain copy, change, and remove.
- Keep the Secure Link precomputed whenever a password is set (as the Editor already
  does) so the primary copy writes to the clipboard within the click gesture; the
  first-time flow encrypts-then-writes inside the dialog submit handler's gesture.
- The size/character indicator reflects whichever Link the primary action would copy
  (the Secure Link once a password is set).

### Viewer changes (reuse existing Viewer seam)

- Replace the Viewer chrome's single "Copy Link" with the same `SplitButton`,
  seeded from how the Document was opened (the presence of the original secure
  Payload).
- Plain Document: primary plain copy; menu offers secure copy, which encrypts the
  in-memory Document via the same Password Dialog and core encrypt call as the
  Editor.
- Secure Document: starts locked; the primary re-emits the original Payload exactly
  (no re-encryption, no password needed); the menu offers a plain copy of the
  decrypted Document. "Copy source" and "Edit" are unchanged.

### Core and cross-cutting rename: "protected" → "secure"

- Rename the core encode/decode/predicate functions and the `protectedPayload`
  prop to their "secure" equivalents, and update the "password required" error
  reasoning's wording where it surfaces, with no change to the `2` version tag, the
  binary frame, or the cryptographic parameters (PBKDF2-HMAC-SHA-256 600k + AES-256-
  GCM per ADR 0003).
- Update prose in `FORMAT.md`, ADR 0003, and `docs/specs/encryption/` to use
  "secure". The change is mechanical and language-only.
- The closed-lock icon is the visual marker of the secure primary; the plain primary
  keeps the existing link icon.

### Architectural decisions

- Respect ADR 0001 (no backend) and ADR 0002 (no third-party requests): all
  encryption stays client-side via native Web Crypto, and no new dependency or
  network request is introduced.
- ADR 0004 records the interaction model, the swap-on-set primary behaviour, the
  seam choices, and the terminology decision.
- No generic Modal abstraction is introduced; a second dialog use would justify
  extracting one later.

## Testing Decisions

Good tests here assert **external, observable behaviour** through the highest
available seam — what the author/reader sees and what Link comes out — never the
internal markup of the split button, the dialog's DOM, or which Web Crypto calls
ran. Prefer the existing Editor and Viewer seams; the two new component seams
(`SplitButton`, `PasswordDialog`) are tested only for behaviour their callers
depend on.

- **Editor (`editor.test.ts`, existing seam):**
  - With no password, the primary copy produces a plain (tag `1`) Link, unchanged
    from today.
  - Choosing the secure menu item opens the dialog; submitting a password produces a
    Secure (tag `2`) Link that the core secure-decode reverses back to the typed
    Document with that password, and the primary segment is now the locked secure
    copy.
  - After a password is set, the primary copy produces a Secure Link without
    reopening the dialog.
  - "Change password…" produces a Secure Link decryptable with the new password but
    not the old; "Remove password" reverts the primary to the plain copy and
    produces a plain Link again.
  - The empty-password guard prevents creating a Secure Link with no secret.
  - The "never says secure" guardrail still holds for the plain path; the secure
    path and dialog are allowed security language.
  - Prior art: the existing "Copy Link produces a Link that decodes back" and
    protect-toggle / password-mismatch tests.
- **Viewer (`viewer.test.ts`, existing seam):**
  - Opening a plain Link seeds the plain primary; choosing secure copy opens the
    dialog and yields a Secure Link decryptable to the same Document.
  - Opening a Secure Link seeds the locked primary; the primary copy re-emits a Link
    that is still secure (tag `2`) and decrypts back to the same Document with the
    password, without prompting for one.
  - The unlock flow and the corrupt-Link error view are unchanged.
  - Prior art: the existing "Copy Link re-emits the protected payload" and unlock
    tests.
- **Core / MCP (existing seams):** the rename keeps all current round-trip,
  wrong-password, malformed-frame, classification, and golden/freeze tests passing
  under the renamed identifiers; the `2`-tag freeze fixture is untouched.
- **No-third-party guard:** the bundle audit still passes — no new dependency, no new
  network request.
- **UI verification:** per the repo's verify rule, the split button and dialog are
  exercised in a real browser via the Chrome DevTools MCP (open menu, set password,
  copy, change, remove; both Editor and Viewer; light and dark themes; keyboard and
  Escape).

## Out of Scope

- **Changing the cryptography or the format.** PBKDF2 + AES-GCM, the binary frame,
  and the `2` tag are unchanged; this is a control and terminology change only.
- **A generic Modal abstraction.** Only the focused `PasswordDialog` is built now.
- **Reusing the reader's unlock password as a session password in the Viewer.** A
  Secure Document re-emits its original Payload; it does not re-encrypt with the
  reader-typed password.
- **Changing a Secure Document's password from the Viewer.** Password management
  (change/remove) is an Editor affordance; the Viewer only copies (plain or the
  original secure Payload).
- **Persisting the session password.** It lives only in memory for the life of the
  Editor/Viewer instance, never stored.
- **Backend, key escrow, accounts, or password recovery.** Unchanged from ADR 0001 /
  ADR 0003 — a lost password is unrecoverable.
- **MCP behaviour changes** beyond renamed identifiers; the create/read contract is
  preserved.
- **Rich link previews / unfurling** for Secure Links (already impossible per ADR
  0001).

## Further Notes

- The threat model is inherited unchanged from ADR 0003: a Secure Link gives
  confidentiality against anyone who holds the Link but not the password, bounded by
  password strength and the KDF cost; a lost password means an unrecoverable
  Document. The split button's swap-on-set behaviour adds one property — downgrading
  a secured Document to a plain Link is always a deliberate menu choice, never the
  default primary action.
- The session password lives only in memory, exactly as the Editor's `password`
  state does today.
- Clipboard writes must stay within the user gesture: with a session password set the
  Secure Link is precomputed so the copy is synchronous; in the first-time dialog flow
  the encrypt-then-write happens inside the submit handler's gesture.
- The "secure" rename is mechanical and carries no format-compatibility risk because
  the `2` tag and frame are untouched; the decode-direction permanence freeze still
  holds.
- This PRD is written to `docs/specs/secure-update/PRD.md` per the request rather than
  published to the issue tracker; the `ready-for-agent` triage step is intentionally
  skipped in favour of file output, mirroring the existing
  `docs/specs/encryption/PRD.md`.
