/**
 * Build a complete Link from a Payload and a base URL.
 *
 * The Payload always travels in the fragment (after `#`) so it is never sent
 * to any server (ADR 0001, ADR 0002). Any existing query string or fragment on
 * `baseUrl` is discarded — a Link carries exactly one Payload.
 *
 * `web` calls this origin-relative (`location.origin + location.pathname`), so
 * no base-URL configuration is needed anywhere.
 */
export function buildLink(payload: string, baseUrl: string): string {
  const hashIndex = baseUrl.indexOf('#');
  const withoutFragment = hashIndex === -1 ? baseUrl : baseUrl.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf('?');
  const base = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  return `${base}#${payload}`;
}

/**
 * Extract the Payload from a full Link's fragment.
 *
 * @returns the Payload, or `null` when the URL has no fragment / an empty one.
 */
export function payloadFromUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }
  const fragment = url.slice(hashIndex + 1);
  return fragment.length === 0 ? null : fragment;
}
