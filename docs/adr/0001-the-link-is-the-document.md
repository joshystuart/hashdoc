# The link is the document

HashDoc embeds an entire markdown Document inside the URL itself — compressed with raw DEFLATE (`fflate`), base64url-encoded, and carried in the URL **fragment** (after `#`) behind a 1-character version tag. There is **no backend**: no account, no upload, no server-side storage or rendering. The Link *is* the datastore.

## Why

The product exists to make AI-generated markdown trivially shareable and privately viewable. Putting the content in the fragment means it is **never transmitted to any server** — not even the static host — so sharing a Link leaks nothing to access logs, CDNs, or analytics. Removing the backend removes the entire class of storage, security, and cost problems, and makes Links effectively permanent (nothing to expire or take down).

## Considered options

- **Query string vs fragment.** Query strings are sent to the server on every request; fragments are not. Chose the fragment for privacy. On a static host we give up nothing, since neither permits per-request server rendering anyway.
- **Storage fallback for large Documents.** Rejected: it reintroduces a backend (storage, auth, cost, content liability) to solve a rare, gracefully-degrading problem.
- **lz-string vs DEFLATE.** Chose standard raw DEFLATE — better ratio on real prose, and the format is decodable by any language's stdlib (`zlib`), keeping Links interoperable and the encoding non-proprietary.

## Consequences

- **No rich link previews.** Because no server can read the fragment, pasting a Link into Slack/iMessage/Teams cannot unfurl the Document's contents.
- **URL length is bounded by where Links are pasted**, not by the browser. Large Documents make long Links; the Viewer and MCP must surface size so users aren't surprised.
- **The format is versioned** by a 1-char tag so compression/encoding can evolve without breaking Links already in the wild.
- The `core` package owns `encode`/`decode` and is the single source of truth shared by the Viewer and the MCP.
