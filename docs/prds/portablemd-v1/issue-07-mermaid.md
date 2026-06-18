# Mermaid diagrams

## Parent

[portablemd v1 — PRD](./PRD.md) · respects [ADR 0002](../../adr/0002-no-third-party-requests.md)

## What to build

` ```mermaid ` fenced blocks render as diagrams — the kind of output agents produce constantly.

- **Lazy-load Mermaid** only when a mermaid block is present.
- Configure Mermaid safely so it cannot inject executable script or arbitrary HTML; keep output within the security posture.
- Works in both the Viewer and the Editor preview.

## Acceptance criteria

- [ ] A ` ```mermaid ` block renders as a diagram in the Viewer.
- [ ] Mermaid loads only when a mermaid block is present.
- [ ] A hostile mermaid input cannot execute script (security-safe config, verified by test).
- [ ] Renders in both Viewer and Editor preview.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
