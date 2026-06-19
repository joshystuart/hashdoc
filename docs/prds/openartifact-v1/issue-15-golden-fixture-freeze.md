# Golden-fixture format freeze

> **Status:** ✅ Done — completed 2026-06-18

## Parent

[openartifact v1 — PRD](./PRD.md) · enforces [ADR 0001](../../adr/0001-the-link-is-the-document.md)

## What to build

Lock the permanence promise: a Link made today must open forever.

- Once the v1 format is settled, add **golden fixtures** mapping known `markdown → exact v1 Payload`, asserted never to change.
- Any future format change must be a **new version tag**, not a mutation of v1.
- This is a **gate**, not a feature — it protects "Links are permanent."

## Acceptance criteria

- [x] A set of golden `(markdown → exact v1 Payload)` fixtures exists in `core`'s tests.
- [x] CI fails if any v1 golden Payload changes.
- [x] A short note records that the v1 format is frozen and future changes require a new version tag.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md) — do once the format has settled.
