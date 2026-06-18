# Syntax highlighting

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

Code blocks render syntax-highlighted, without weighing down Documents that contain no code.

- **Lazy-load `highlight.js`** only when the Document contains code blocks.
- Apply highlighting within the shared `render()` path so the Viewer and the Editor preview match.
- Highlighted output stays within the sanitization guarantees (no DOMPurify bypass).

## Acceptance criteria

- [ ] Fenced code blocks with a language render highlighted.
- [ ] `highlight.js` loads only when code blocks are present (verified absent otherwise).
- [ ] Highlighting is identical in the Viewer and the Editor preview.
- [ ] Highlighted output remains sanitized.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
