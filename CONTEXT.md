# HashDoc

A client-side-only web app for sharing markdown. A markdown document is compressed into a URL so it can be shared as a single link and rendered nicely by anyone who opens it — no account, no upload, nothing stored on a server.

## Language

**Document**:
A single markdown file shared through HashDoc. The unit a person wants someone else to read.
_Avoid_: doc, file, snippet, paste, gist

**Payload**:
The encoded form of a Document that travels inside a Link. One Payload corresponds to exactly one Document.
_Avoid_: hash, blob, data, content string

**Link**:
The complete URL that carries a Payload in its fragment. The only artifact a person shares; opening it reconstructs the Document.
_Avoid_: share URL, paste, hash link

**Viewer**:
The read view of the web app: decodes a Link and renders its Document. Read-first; editing is a separate mode.
_Avoid_: reader, site, page

**Editor**:
The create/edit mode of the web app: a markdown source editor with live preview. Saving produces a *new* Link (a snapshot) — it never mutates the Link you opened.
_Avoid_: composer, workspace

**Secure Link**:
A Link whose Document is encrypted client-side under an author-chosen password (format v2, tag `2`). The password never travels in the Link and is shared out-of-band; a lost password means an unrecoverable Document. "Secure" is the single term for this scheme across the UI, code, and docs.
_Avoid_: protected link, encrypted link, password link, private link

**Split Button**:
The copy control shared by the Editor and Viewer: a primary segment plus a caret menu. Its primary action is the plain "Copy Link" until a password is set, then becomes "Copy secure link" (closed-lock icon), with the other copy/manage actions in the menu.
_Avoid_: dropdown button, combo button, menu button

**Password Dialog**:
The native-`<dialog>` modal that takes the author's password (single field with a show/hide toggle) when creating or changing a Secure Link. Carries the share-separately / unrecoverable-if-lost warning.
_Avoid_: modal, popup, password prompt (the reader-side unlock view is the Unlock prompt, a separate surface)
