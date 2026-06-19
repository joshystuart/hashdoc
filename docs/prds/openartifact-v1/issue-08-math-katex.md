# Math (KaTeX)

> **Status:** ✅ Done — completed 2026-06-18

## Parent

[openartifact v1 — PRD](./PRD.md) · respects [ADR 0002](../../adr/0002-no-third-party-requests.md)

## What to build

Inline (`$…$`) and block (`$$…$$`) math render via **KaTeX**, lazy-loaded only when math is present.

- Detect math syntax and **lazy-load KaTeX** on demand.
- KaTeX CSS and **fonts are bundled/self-hosted** — no CDN request (ADR 0002).
- Works in both the Viewer and the Editor preview.

## Acceptance criteria

- [x] Inline and block math render correctly.
- [x] KaTeX loads only when math syntax is present.
- [x] KaTeX fonts/assets are self-hosted (no third-party request).
- [x] Renders in both Viewer and Editor preview.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
