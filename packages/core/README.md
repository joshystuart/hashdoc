# @hashdoc/core

Core HashDoc utilities for encoding markdown into self-contained URL fragments and decoding those fragments back into markdown.

HashDoc Links keep the document in the URL fragment after `#`, so the document is not sent to the origin server in normal HTTP requests. Links are still bearer-access: anyone with a plain Link can read the document.

## Install

```bash
npm install @hashdoc/core
```

## Plain Links

```ts
import { buildLink, decode, encode, payloadFromUrl } from '@hashdoc/core';

const payload = encode('# Hello HashDoc');
const url = buildLink(payload, 'https://hashdoc.dev/');

const decodedPayload = payloadFromUrl(url);
if (decodedPayload === null) {
  throw new Error('Missing HashDoc payload');
}

const markdown = decode(decodedPayload);
```

## Secure Links

Secure Links encrypt the compressed markdown with AES-256-GCM using a key derived from the password with PBKDF2-HMAC-SHA-256.

```ts
import {
  buildLink,
  decodeSecure,
  encodeSecure,
  payloadFromUrl,
} from '@hashdoc/core';

const payload = await encodeSecure(
  '# Private note',
  'correct horse battery staple',
);
const url = buildLink(payload, 'https://hashdoc.dev/');
const decodedPayload = payloadFromUrl(url);

if (decodedPayload === null) {
  throw new Error('Missing HashDoc payload');
}

const markdown = await decodeSecure(
  decodedPayload,
  'correct horse battery staple',
);
```

The password is not stored in the Link. Share it separately from the Link.

## API

- `encode(markdown)` creates a plain HashDoc payload.
- `decode(payload)` reads a plain HashDoc payload.
- `encodeSecure(markdown, password)` creates an encrypted HashDoc payload.
- `decodeSecure(payload, password)` reads an encrypted HashDoc payload.
- `isSecure(payload)` returns whether a payload uses the secure Link format.
- `buildLink(payload, baseUrl)` appends a payload as the URL fragment.
- `payloadFromUrl(url)` extracts a payload from a full Link URL.
- `linkSizeWarning(characters)` returns a sharing warning for long Links.
- `DecodeError` and `classifyDecodeError(error)` expose structured decode failures.

The plain v1 Link format is frozen and documented in the repository's `packages/core/FORMAT.md`.
