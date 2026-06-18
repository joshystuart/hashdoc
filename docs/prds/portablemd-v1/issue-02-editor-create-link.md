# Author creates a Link — Editor MVP

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

A person with no Link can author one and get a shareable Link back.

- With no fragment, the web app shows the **Editor** in new mode: a **CodeMirror 6** markdown source pane with a formatting toolbar and a **live preview**.
- The live preview uses the **same `render()` module** as the Viewer, so what the Author sees is exactly what the Reader gets.
- A prominent **Copy Link** action encodes the current content into an origin-relative Link and copies it to the clipboard.
- The Editor (CodeMirror + editing UI) **lazy-loads** so the Viewer stays featherweight.

## Acceptance criteria

- [ ] Visiting the site with no fragment shows the Editor (split source + preview).
- [ ] Live preview output is identical to the Viewer's render of the same markdown.
- [ ] Copy Link produces a Link whose fragment `decode`s back to exactly the typed markdown.
- [ ] The Editor/CodeMirror bundle is lazy-loaded (absent from the initial Viewer payload).
- [ ] A behaviour test drives type → Copy Link → re-open → rendered Document.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
