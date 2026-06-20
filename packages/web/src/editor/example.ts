export const EXAMPLE_DOC = `# HashDoc

**The link _is_ the document.** Everything you write lives inside the URL —
nothing is stored on a server, and nothing is sent anywhere. Share the link and
anyone who has it can read this, right in their browser.

This page is itself an HashDoc document. To write your own, select all
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
