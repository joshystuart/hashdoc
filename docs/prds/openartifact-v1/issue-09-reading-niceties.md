# Reading niceties — anchors, copy buttons, tab title, print

> **Status:** ✅ Done — completed 2026-06-18
> Note: heading anchors scroll into view and are payload-safe; the URL fragment is
> intentionally NOT mutated (it carries the Document Payload per ADR 0001, so
> navigating it would destroy the Document).

## Parent

[openartifact v1 — PRD](./PRD.md)

## What to build

The cheap, always-on features that make a Document pleasant to read and reuse.

- **Heading anchors**: clickable, deep-linkable headings that update the URL and scroll.
- **Copy buttons**: copy a code block, copy the raw markdown source, and copy the Link.
- **Tab title** derived from the Document's first H1 (sensible fallback when there's none).
- **Print CSS** so browser Print → PDF produces a clean layout.

## Acceptance criteria

- [x] Headings have clickable anchors that update the URL and scroll into view. _(scroll + payload-safe; fragment not mutated — see note above)_
- [x] Copy-code, copy-source, and copy-Link actions copy the correct content.
- [x] The browser tab title reflects the Document's first H1 (with a fallback).
- [x] A print stylesheet produces a clean printed/PDF layout.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
