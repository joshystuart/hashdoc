export function buildLink(payload: string, baseUrl: string): string {
  const hashIndex = baseUrl.indexOf('#');
  const withoutFragment = hashIndex === -1 ? baseUrl : baseUrl.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf('?');
  const base = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  return `${base}#${payload}`;
}

export function payloadFromUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }
  const fragment = url.slice(hashIndex + 1);
  return fragment.length === 0 ? null : fragment;
}
