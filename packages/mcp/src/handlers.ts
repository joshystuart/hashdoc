import {
  encode,
  decode,
  encodeSecure,
  decodeSecure,
  isSecure,
  buildLink,
  payloadFromUrl,
  linkSizeWarning,
  DecodeError,
} from '@hashdoc/core';

export interface CreateMarkdownLinkResult {
  url: string;
  characters: number;
  warning?: string;
}

export interface ReadMarkdownLinkResult {
  markdown: string;
}

export async function createMarkdownLink(
  args: { markdown: string; password?: string | undefined },
  baseUrl: string,
): Promise<CreateMarkdownLinkResult> {
  const payload =
    args.password && args.password.length > 0
      ? await encodeSecure(args.markdown, args.password)
      : encode(args.markdown);
  const url = buildLink(payload, baseUrl);
  const characters = url.length;
  const warning = linkSizeWarning(characters);
  return warning === undefined ? { url, characters } : { url, characters, warning };
}

export async function readMarkdownLink(args: {
  url: string;
  password?: string | undefined;
}): Promise<ReadMarkdownLinkResult> {
  const payload = payloadFromUrl(args.url) ?? args.url;
  if (isSecure(payload)) {
    if (!args.password || args.password.length === 0) {
      throw new DecodeError(
        'password-required',
        'This Link is secure. A password is required to open it.',
      );
    }
    return { markdown: await decodeSecure(payload, args.password) };
  }
  return { markdown: decode(payload) };
}

export { DecodeError };
