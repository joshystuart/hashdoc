# Reading niceties — anchors, copy buttons, tab title, print

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

The cheap, always-on features that make a Document pleasant to read and reuse.

- **Heading anchors**: clickable, deep-linkable headings that update the URL and scroll.
- **Copy buttons**: copy a code block, copy the raw markdown source, and copy the Link.
- **Tab title** derived from the Document's first H1 (sensible fallback when there's none).
- **Print CSS** so browser Print → PDF produces a clean layout.

## Acceptance criteria

- [ ] Headings have clickable anchors that update the URL and scroll into view.
- [ ] Copy-code, copy-source, and copy-Link actions copy the correct content.
- [ ] The browser tab title reflects the Document's first H1 (with a fallback).
- [ ] A print stylesheet produces a clean printed/PDF layout.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
