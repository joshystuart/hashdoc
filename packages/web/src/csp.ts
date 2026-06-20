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

export function securityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  };
}

export function renderNetlifyHeaders(headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  return `/*\n${lines.join('\n')}\n`;
}
