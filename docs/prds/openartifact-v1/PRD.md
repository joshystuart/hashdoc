# openartifact v1 — PRD

> Status: ready-for-agent · Date: 2026-06-18
> Glossary: [CONTEXT.md](../../../CONTEXT.md) (Document · Payload · Link · Viewer · Editor)
> Decisions: [ADR 0001 — The link is the document](../../adr/0001-the-link-is-the-document.md) · [ADR 0002 — No third-party requests](../../adr/0002-no-third-party-requests.md)

## Problem Statement

AI agents now generate large volumes of markdown — specs, plans, analyses, docs. Sharing that markdown with another person is awkward: pasted into chat it's an unformatted wall of text, and the recipient only sees it rendered nicely if they already happen to have the right tool installed (an IDE, Obsidian, a markdown app). There is no friction-free way to send someone a markdown Document and have them see it rendered beautifully, immediately, with nothing to install and no account to create.

Existing "paste" services solve the rendering problem but introduce two new ones: they store your content on their servers (a privacy concern for sensitive material) and your shared links live only as long as that service does (a longevity concern).

## Solution

**openartifact** is a client-side-only web app that renders shared markdown beautifully from a single Link. The entire Document is compressed and embedded in the URL **fragment**, so opening a Link reconstructs and renders the Document with **no server ever receiving or storing the content**. Anyone can open a Link in a browser — nothing to install, no account, no tracking.

- **People** create Links by pasting markdown into the **Editor** and copying the resulting Link.
- **Agents** create Links directly through an **MCP** server, so they can hand a user a ready-to-share Link as part of their normal output.
- **Recipients** open the Link, read the rendered Document, and can optionally fork-and-edit it into their own new Link.

Because the Link *is* the Document, Links are effectively permanent (nothing to expire or take down) and provably private from servers (the content never leaves the client).

## User Stories

**Reader (recipient of a Link)**
1. As a Reader, I want to open a Link and immediately see the Document rendered nicely, so that I can read shared markdown without installing anything.
2. As a Reader on my phone, I want the Document to be readable and responsive, so that I can comfortably read links people send me in chat while on the go.
3. As a Reader, I want code blocks syntax-highlighted, so that shared code is legible.
4. As a Reader, I want Mermaid diagrams rendered as actual diagrams, so that I can understand the architecture and flowcharts agents produce.
5. As a Reader, I want math rendered properly, so that technical documents with formulae are legible.
6. As a Reader, I want GFM tables, task lists, and strikethrough rendered correctly, so that structured content displays as intended.
7. As a Reader, I want a dark/light theme that respects my system preference (with a manual toggle), so that reading is comfortable.
8. As a Reader, I want clickable heading anchors, so that I can deep-link to a section of a long Document.
9. As a Reader, I want to copy any code block with one click, so that I can use shared snippets.
10. As a Reader, I want to copy the raw markdown source of the Document, so that I can reuse it in my own tools.
11. As a Reader, I want a clear, friendly message when a Link is broken or truncated — explaining that long links sometimes get cut off in chat — so that I know what went wrong and what to do next.
12. As a Reader, I want a meaningful browser tab title (taken from the Document's first heading), so that my tabs and history stay navigable.
13. As a Reader, I want it to be obvious that "anyone with this link can read it," so that I never mistake a Link for something secret.
14. As a Reader, I want opening a malicious Link to be unable to run scripts in my browser, so that clicking shared Links is safe.

**Author (person creating a Link)**
15. As an Author, I want to paste markdown and instantly see a live preview, so that I know exactly how the recipient will see it.
16. As an Author, I want the preview to be identical to what the Reader sees, so that there are no rendering surprises after I share.
17. As an Author, I want to copy a single Link that contains my whole Document, so that I can share it anywhere a URL goes.
18. As an Author, I want syntax highlighting and a formatting toolbar while editing, so that authoring markdown is comfortable.
19. As an Author, I want to be warned when my Document is large enough that the Link may not paste cleanly everywhere, so that I'm not surprised when a recipient receives a broken Link.
20. As an Author, I want to land on a short self-describing example when I open the site with no Link, so that I understand the tool immediately and have something to edit.
21. As an Author, I want each save to produce a *new* Link rather than mutate the one I opened, so that I always get a fresh shareable snapshot.
22. As an Author, I want to be warned when I embed images (size and privacy implications), so that I understand the consequences before sharing.
23. As an Author on desktop, I want a comfortable split-pane source + preview, so that I can write efficiently.

**Reader who edits (fork-and-share)**
24. As a Reader, I want to click "Edit" on a Document I received, tweak it, and get my own new Link, so that I can reply with an amended version.
25. As a Reader, I want it to be clear that editing creates a new Link and does not change the sender's, so that I understand there is no shared live Document.

**Agent (via MCP)**
26. As an Agent, I want to call a tool with markdown and receive a shareable Link, so that I can give my user something they can immediately send to others.
27. As an Agent, I want the tool to report the Link's size and warn me when it's large, so that I can advise the user before handing them a giant URL.
28. As an Agent, I want to decode a Link a user gives me back into markdown, so that I can read and work with a shared Document.
29. As an Agent, I want Link creation to need no network and no account, so that I can produce Links reliably, offline, and privately.
30. As an Agent, I want produced Links to point at the user's configured openartifact domain, so that they open on the correct site.

**Developer (self-hoster / integrator)**
31. As a Developer, I want to add the MCP with a single `npx` command and one env var, so that setup is trivial.
32. As a Developer, I want the web app to work on any static host with zero configuration, so that I can self-host it anywhere.
33. As a Developer, I want the Link format to be versioned, so that future format changes don't break Links already shared.
34. As a Developer, I want confidence that today's Links will still open in future versions, so that I can promise users their Links are permanent.
35. As a Developer, I want the site to make zero third-party requests, so that the privacy guarantee holds and there is nothing to audit.
36. As a Developer, I want shared Links to unfurl as a clean branded card in chat apps, so that they look trustworthy even though contents can't be previewed.
37. As a Developer, I want encode/decode to be a single shared module, so that the web app and MCP can never drift out of sync.

**Privacy**
38. As an Author, I want the Document to never be transmitted to or stored on any server, so that I retain control of potentially sensitive content.

## Implementation Decisions

**Repository & packages**
- A single **pnpm monorepo, TypeScript throughout**, with three packages:
  - **`core`** — the Link *format only*: `encode`/`decode` and version-tag handling. Sole runtime dependency is `fflate`. Deliberately contains **no rendering and no DOM dependency**, so the `mcp` stays tiny and the format remains the single source of truth shared by `web` and `mcp`. (Per ADR 0001.)
  - **`web`** — the Viewer, the Editor, and the shared **render module**. Imports `core`.
  - **`mcp`** — the MCP server. Imports `core` only.

**Link format (ADR 0001)**
- Pipeline: `markdown` → UTF-8 bytes → **raw DEFLATE** (`fflate` `deflateRaw`) → **base64url** (no padding) → prefix a **1-character version tag**. v1 tag = `1`.
- The Payload is carried in the URL **fragment**. The web app builds Links **origin-relative** (`location.origin + location.pathname + '#' + payload`); the web app needs no base-URL configuration.
- `decode` dispatches on the version tag; an unknown tag yields a typed "unsupported version" error rather than garbage.
- Decision-encoding shape (from the design session):
  ```ts
  // @openartifact/core — format only, no DOM, no rendering
  encode(markdown: string): string             // → fragment payload, incl. version tag
  decode(payload: string): string              // throws DecodeError on corrupt/truncated/unknown-version
  buildLink(payload: string, baseUrl: string): string
  payloadFromUrl(url: string): string | null   // extract the fragment payload from a full URL
  ```
- The version tag is the single sanctioned mechanism for evolving the format later (e.g. an encrypted variant or a better compressor) without breaking existing Links.

**Rendering & safety**
- `web` exposes one **`render(markdown: string): string`** (safe HTML), built on **`markdown-it`** (`html: true`, `linkify: true`) piped through **`DOMPurify`**. The *same* module powers the Viewer and the Editor's live preview — guaranteeing preview output equals Reader output.
- **Sanitized inline HTML** posture: DOMPurify's default-safe profile (keeps `<details>`, `<kbd>`, `<sub>`, etc.); strips `<script>`, event handlers, `javascript:` URLs, and frames. External links are forced to `target="_blank" rel="noopener noreferrer"`.
- Heavy renderers **lazy-load only when the Document contains the construct**: `highlight.js` (code blocks), **Mermaid** (```mermaid fences), **KaTeX** (`$…$` / `$$…$$`).
- `render` runs in the browser; DOMPurify requires a DOM (jsdom under test).

**Web app states (routed on the fragment)**
- Fragment **present** → **Viewer**: renders the Document, read-first, with Edit / Copy Link / Copy source actions.
- Fragment **absent** → **Editor** in new mode, seeded with a short **self-describing example Document** (this is also the de-facto landing page — there is no separate marketing site).
- Fragment **corrupt/truncated** → graceful error state leading with the truncation explanation and a **New Document** action.
- **Unknown version tag** → "made with a newer version" error.
- The app **never white-screens** on a bad Link.
- Always-on Viewer features: GFM, heading anchors, copy (code/source/link), dark/light theme (system + persisted toggle), tab title from first H1, print CSS.

**Editor**
- **CodeMirror 6** source editor + formatting toolbar + live preview, in **Preact**, **lazy-loaded** on first Edit so the Viewer stays featherweight. "Copy Link" encodes the current content into a new Link. Large-Document and embedded-image warnings surface here.
- UI copy reflects the **bearer-access** model ("anyone with this link can read it"); a Link is never described as "secure."

**MCP**
- **Two tools**, pure-local, zero network. Decision-encoding shapes:
  ```ts
  create_markdown_link(input: { markdown: string }):
    { url: string; characters: number; warning?: string }
  read_markdown_link(input: { url: string }):
    { markdown: string }
  ```
- `warning` is set when `characters` exceeds the "may not paste everywhere" threshold. There is **no `update` tool** — fork-and-share has no identity, so editing is just another `create`.
- Distribution: **`npx @openartifact/mcp` over stdio**. **`OPENARTIFACT_BASE_URL`** env var sets the origin used when building Links (defaults to a local dev URL for testing). `read_markdown_link` accepts a full URL or a bare Payload and fails gracefully on corrupt/truncated input. No hosted MCP.

**Ops & privacy (ADR 0002)**
- **Zero third-party requests**: no analytics, no error tracking, no CDN-hosted fonts or scripts; all assets bundled and self-hosted. Origin-relative; runs on any static host with **no serverless functions**.
- **Strict CSP** via `<meta http-equiv>` as defense-in-depth behind DOMPurify: `script-src 'self'`; `img-src 'self' data: https:` (data:/https: required because author-embedded images are allowed); `style-src` covering KaTeX/highlight (hashes or `'unsafe-inline'` as needed); `connect-src 'self'`.
- **Static branded OG/Twitter card**, identical for every Link. Per-content previews are impossible by design (no server ever sees the fragment).

## Testing Decisions

**What makes a good test here:** assert *external behaviour*, never implementation detail. Test "markdown containing `<script>` renders to HTML with no executable script," not "markdown-it was configured with `html:true`." Test "a Document run through `encode` then `decode` returns the original," not the internal byte layout — *except* for a deliberate set of golden fixtures whose entire purpose is to freeze the format.

**Seams (all new — greenfield; proposed at the highest available points):**

1. **Format seam — `core` public API.** Black-box `encode`/`decode`:
   - Round-trip property tests over varied markdown (Unicode, code fences, GFM tables, inline HTML, very large Documents).
   - **Golden fixtures** mapping `markdown → exact Payload` that **must not change for v1** — this is what *enforces* "Links are permanent."
   - Corrupt, truncated, and unknown-version inputs produce typed errors.
   - Highest seam for the format and the single most important test surface.
2. **Render/safety seam — `web` `render()`.** Black-box `string → safeHTML`:
   - A first-class **security suite** of malicious markdown (script tags, `onerror`/`on*` handlers, `javascript:` hrefs, data-URI script, SVG vectors) asserting each is neutralised.
   - Construct rendering: GFM features and the allowed inline-HTML subset render correctly.
   - Run in node with jsdom (for DOMPurify).
3. **Web app behaviour seam — drive by URL/fragment.** Assert what the *user sees* given an input fragment:
   - Valid → rendered Document; absent → new Editor with example; corrupt/truncated → error state; unknown version → version error.
   - Author flow: type markdown → Copy Link → the produced Link's fragment decodes back to the same markdown (round-trip through the real UI).
   - Fork flow: Edit a viewed Document → new Link produced, original Link unaffected.
   - Testing Library + jsdom for component/integration; Playwright for true E2E of URL-driven behaviour and clipboard where warranted.
4. **MCP seam — tool handlers.** Call `create_markdown_link` / `read_markdown_link` handlers directly:
   - Created `url` decodes (via `core`) back to the input markdown; `url` honours `OPENARTIFACT_BASE_URL`; `warning` appears past the threshold.
   - `read_markdown_link` round-trips and fails gracefully on corrupt input.
   - Highest seam below spinning up a real stdio client.

**Modules tested:** `core` (format), `web` (render, app behaviour, editor), `mcp` (tools).
**Prior art:** none (greenfield). Establish: **Vitest** for `core`/`mcp` (unit, round-trip, golden); **Testing Library + jsdom** (and **Playwright** where needed) for `web` behaviour; a dedicated **sanitization/security** test category as first-class, not an afterthought.

## Out of Scope

- Any **backend or storage fallback** for large Documents — explicit non-goal (ADR 0001).
- **Real-time / multiplayer** collaboration — only async fork-and-share snapshots.
- **Client-side encryption / secret Links** — bearer-access only in v1; reserved for a future version tag.
- **WYSIWYG editing** — source-based only.
- **TOC sidebar, PDF/export libraries, image/file upload pipeline, in-Document search, multi-Document bundles, comments.**
- **Hosted MCP** — stdio/local only.
- **Analytics / telemetry of any kind** (ADR 0002).
- **Separate marketing/landing page** — the self-describing example empty state is the landing.
- **Per-content link previews/unfurls** — architecturally impossible.
- **Shiki** syntax highlighting — `highlight.js` for v1.

## Further Notes

- **Durability is a product promise.** The v1 golden fixtures freeze the format; the version tag is the only sanctioned way to evolve it. Future tags can introduce an encrypted format or a better compressor without breaking existing Links.
- **The MCP inherits the privacy story for free** because it does pure local string math and makes no network calls.
- **Mobile-first matters for the Viewer specifically** — shared Links are opened on phones constantly. The Editor is desktop-primary but should remain usable on mobile.
- **A shorter domain yields shorter Links** (URL length is the product's main constraint); choose the deployment domain with that in mind.
- **Natural future fit (not v1):** a PWA / service-worker app shell so any Link opens offline once the shell is cached — fully consistent with the no-backend architecture.
- **Bearer-access threat model must be communicated in UI copy;** never market a Link as "secure."
