# Editor warnings — large Document + embedded images

> **Status:** ✅ Done — completed 2026-06-18

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

Warn the Author before they share something that won't travel well — the URL is the product's main constraint.

- A **size indicator + warning** when the resulting Link crosses the "may not paste everywhere" threshold, using `core`'s shared size helper (so it agrees with the MCP's warning).
- An **embedded-image warning** when the markdown contains images, explaining the two sharp edges: Payload bloat and the IP-leak when a remote image is fetched.
- Warnings are **advisory** — they never block Copy Link.

## Acceptance criteria

- [x] The Editor shows the current Link size and a clear warning past the threshold.
- [x] Embedding an image surfaces a warning explaining size + privacy implications.
- [x] Warnings never block Copy Link.
- [x] Threshold logic comes from `core`'s shared helper (consistent with the MCP).

## Blocked by

- [issue-02 — Editor MVP](./issue-02-editor-create-link.md)
