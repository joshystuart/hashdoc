export const EXAMPLE_DOC = `# HashDoc

**The link _is_ the document.** Everything you write lives inside the URL —
nothing is stored on a server, and nothing is sent anywhere. Share the link and
anyone who has it can read this, right in their browser.

This page is itself a HashDoc document. To write your own, select all
(Cmd/Ctrl+A) and replace it, then press **Copy Link**.

## How a link works

\`\`\`
https://hashdoc.ghost7.org/#1y0jNyclXKM8vykkBAA
└────────────┬────────────┘└────────┬─────────┘
          origin                   Payload
\`\`\`

- **origin** — the static site that renders the link. It serves only the app; it never receives the document.
- **\`#\` fragment** — everything after \`#\` stays in the browser. Browsers do not send the fragment to the server in requests or \`Referer\` headers.
- **version tag** — the first character of the Payload: \`1\` for a plain link, \`2\` for a secure link.
- **Payload** — the whole document, compressed (and, for secure links, encrypted) and base64url-encoded.

## What it does

- Renders Markdown (GFM): headings, **bold**, _italic_, lists, tables, code.
- Encodes the whole document into the link — client-side, no account, no upload.
- Bearer-access: anyone with the link can read it. Treat the link like the contents.

## Secure links

A plain link is bearer-access: anyone who has it can read the document. When that
is not enough, use **Copy secure link** instead of **Copy Link**.

- You set a password, and the document is encrypted in your browser with
  AES-256-GCM before it ever touches the link.
- The password is **never** stored in the link. Share it separately — never in the
  same message as the link.
- Opening a secure link shows a password prompt; the document only appears once the
  correct password is entered.
- If the password is lost, the document is unrecoverable. There is no reset.

Secure links work exactly like plain links otherwise: nothing is uploaded, and the
encrypted document still lives entirely inside the URL.

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
