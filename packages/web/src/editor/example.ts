/**
 * The self-describing example Document (issue-12).
 *
 * When the Editor opens with no fragment (the no-fragment new mode), this seeds
 * the source pane. It doubles as the landing page: there is no separate
 * marketing site (the Link *is* the document). The example is itself a real
 * portablemd Document — genuine markdown exercising the headline constructs
 * (H1, prose, fenced code, a GFM table, a task list) so the live preview is a
 * real demonstration of what the tool renders.
 *
 * The Author can select-all (Cmd/Ctrl+A) and replace it to start writing.
 *
 * Kept deliberately concise so the landing is fast and the Link stays small
 * when an Author copies before editing. Not shown when forking an existing
 * Document (issue-03 passes initialMarkdown, which takes precedence).
 */
export const EXAMPLE_DOC = `# portablemd

**The link _is_ the document.** Everything you write lives inside the URL —
nothing is stored on a server, and nothing is sent anywhere. Share the link and
anyone who has it can read this, right in their browser.

This page is itself a portablemd document. To write your own, select all
(Cmd/Ctrl+A) and replace it, then press **Copy Link**.

## What it does

- Renders Markdown (GFM): headings, **bold**, _italic_, lists, tables, code.
- Encodes the whole document into the link — client-side, no account, no upload.
- Bearer-access: anyone with the link can read it. Treat the link like the contents.

## A quick demo

A fenced code block (syntax highlighted in the preview):

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

A table:

| Construct | Supported |
| --------- | --------- |
| Headings  | yes       |
| Tables    | yes       |
| Code      | yes       |

A task list:

- [x] Write some markdown
- [x] Press Copy Link
- [ ] Share it
`;
