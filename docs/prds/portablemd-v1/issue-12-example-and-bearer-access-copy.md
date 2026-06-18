# Self-describing example + bearer-access copy

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

Make the empty state teach the tool, and make the trust model honest.

- The no-fragment empty state is a **self-describing example Document** — itself a portablemd Document — that demonstrates rendering and explains what the tool does. It doubles as the landing page (there is no separate marketing site); the Author selects-all and replaces it to start.
- Add quiet **bearer-access** messaging where a Link is created/copied: "anyone with this link can read it." Never use the word "secure."

## Acceptance criteria

- [ ] Opening the site with no fragment shows a self-describing example Document in the Editor, ready to select-all and replace.
- [ ] The example renders the headline constructs (headings, code, a table, etc.) as a live demo.
- [ ] Bearer-access messaging appears at the point a Link is created/copied; "secure" is never used.

## Blocked by

- [issue-02 — Editor MVP](./issue-02-editor-create-link.md)
