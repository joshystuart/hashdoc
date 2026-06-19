# Branded OG card (HITL)

> **Status:** 🟡 Implemented — completed 2026-06-18 (automatable parts).
> The two human-only criteria below remain for the user: design review/approval
> and a real chat-app unfurl test. Generated card is at
> [packages/web/public/og-card.png](../../../packages/web/public/og-card.png)
> (editable source: [og-card.svg](../../../packages/web/public/og-card.svg)).

## Parent

[openartifact v1 — PRD](./PRD.md)

## What to build

Make a shared Link look trustworthy when pasted into chat apps, despite contents being un-previewable.

- Ship **static Open Graph / Twitter meta tags** (title, description, image) on every page — identical for every Link (per-content previews are impossible by design, since no server sees the fragment).
- Produce a **branded card image / logo**, self-hosted.

**HITL:** needs a logo/brand asset and a human design review.

## Acceptance criteria

- [x] Static OG/Twitter meta tags are present on every page.
- [x] A branded card image (logo) exists and is self-hosted (no third-party request).
- [ ] Pasting a Link into a major chat app unfurls the branded card. _(HITL — user to verify)_
- [ ] The card design is reviewed and approved by a human. _(HITL — user to verify)_

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
