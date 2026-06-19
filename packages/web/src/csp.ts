import { createHash } from 'node:crypto';

export function inlineScriptBodies(html: string): string[] {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const bodies: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutComments)) !== null) {
    const attrs = match[1] ?? '';
    if (/\bsrc\s*=/.test(attrs)) {
      continue;
    }
    const body = match[2] ?? '';
    if (body.length > 0) {
      bodies.push(body);
    }
  }
  return bodies;
}

export function inlineScriptHash(scriptBody: string): string {
  const digest = createHash('sha256').update(scriptBody, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

export function buildCsp(scriptHashes: readonly string[]): string {
  const scriptSrc = ["'self'", ...scriptHashes].join(' ');
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
}
