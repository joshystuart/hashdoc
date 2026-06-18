# portablemd

A client-side-only web app for sharing markdown. A markdown document is compressed into a URL so it can be shared as a single link and rendered nicely by anyone who opens it — no account, no upload, nothing stored on a server.

## Language

**Document**:
A single markdown file shared through portablemd. The unit a person wants someone else to read.
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
