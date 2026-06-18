# Privacy & safety hardening — zero third-party + CSP + sanitization suite

## Parent

[portablemd v1 — PRD](./PRD.md) · enforces [ADR 0002](../../adr/0002-no-third-party-requests.md)

## What to build

Lock the security and privacy posture the whole product rests on.

- **Audit and guarantee zero third-party requests**: all fonts/assets bundled and self-hosted, no CDN.
- Add a **strict CSP** via `<meta http-equiv>`: `script-src 'self'`; `img-src 'self' data: https:` (author-embedded images are allowed); `style-src` covering KaTeX/highlight (hashes or `'unsafe-inline'`); `connect-src 'self'`.
- Add a first-class **sanitization security suite** for `render()` — script tags, `on*` handlers, `javascript:` hrefs, data-URI script, SVG vectors — and force external links to `target="_blank" rel="noopener noreferrer"`.

## Acceptance criteria

- [ ] No network request leaves the origin on load (fonts/assets all self-hosted).
- [ ] A strict CSP is present and does not break highlight.js / Mermaid / KaTeX / data-image rendering.
- [ ] The sanitization suite proves common XSS vectors are neutralized.
- [ ] External links open with `target="_blank" rel="noopener noreferrer"`.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md) — best sequenced after [issue-06](./issue-06-syntax-highlighting.md), [issue-07](./issue-07-mermaid.md), [issue-08](./issue-08-math-katex.md) so the CSP can account for their injected styles.
