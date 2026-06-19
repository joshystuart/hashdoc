# Edit & fork a viewed Document

> **Status:** ✅ Done — completed 2026-06-18

## Parent

[openartifact v1 — PRD](./PRD.md)

## What to build

A Reader can amend a Document they received and share their own version, without ever changing the sender's Link (async fork-and-share — per the glossary, editing creates a *new* Link; there is no shared live Document).

- From the Viewer, an **Edit** action opens the Editor pre-filled with the current Document.
- Saving / Copy Link produces a **new** Link (a snapshot); the Link originally opened is never mutated.
- The UI makes the fork explicit — it's clear a new Link was created, not an in-place edit.

## Acceptance criteria

- [x] The Viewer shows an Edit action that opens the Editor pre-filled with the viewed Document.
- [x] Editing + Copy Link yields a different Link; the original Link still decodes to the original Document.
- [x] The UI communicates that a new Link was created.
- [x] Behaviour test: view → Edit → change → Copy Link → original Link unaffected, new Link reflects the change.

## Blocked by

- [issue-02 — Editor MVP](./issue-02-editor-create-link.md)
