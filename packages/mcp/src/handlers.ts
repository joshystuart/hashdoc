import {
  encode,
  decode,
  buildLink,
  payloadFromUrl,
  linkSizeWarning,
  DecodeError,
} from '@portablemd/core';

export interface CreateMarkdownLinkResult {
  url: string;
  characters: number;
  warning?: string;
}

export interface ReadMarkdownLinkResult {
  markdown: string;
}

export function createMarkdownLink(
  args: { markdown: string },
  baseUrl: string,
): CreateMarkdownLinkResult {
  const url = buildLink(encode(args.markdown), baseUrl);
  const characters = url.length;
  const warning = linkSizeWarning(characters);
  return warning === undefined ? { url, characters } : { url, characters, warning };
}

export function readMarkdownLink(args: { url: string }): ReadMarkdownLinkResult {
  const payload = payloadFromUrl(args.url) ?? args.url;
  return { markdown: decode(payload) };
}

export { DecodeError };
