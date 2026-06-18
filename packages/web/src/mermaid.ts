/**
 * Lazy Mermaid island. This module (and the Mermaid library it imports) is only
 * ever reached through a dynamic `import()` in {@link enhance}, so Vite
 * code-splits it into a separate async chunk. Documents with no mermaid blocks
 * never load any of it, and it never enters the Viewer entry chunk.
 *
 * Mermaid is initialised with `securityLevel: 'strict'` (Mermaid sanitises
 * labels and blocks raw HTML / scripts) and `startOnLoad: false` (we drive
 * rendering ourselves). The SVG it returns is still run back through DOMPurify
 * in {@link enhance} before it touches the live DOM — defence in depth, no
 * DOMPurify bypass even from Mermaid's own output.
 *
 * The library is bundled locally (no CDN) so ADR 0002 — zero third-party
 * requests — still holds.
 */
import mermaid from 'mermaid';

let initialised = false;

function ensureInitialised(): void {
  if (initialised) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    // 'strict' sanitises text in diagram labels and forbids raw HTML/script —
    // never use 'loose'. This is the first line of defence; DOMPurify is the
    // second (see enhance()).
    securityLevel: 'strict',
  });
  initialised = true;
}

/**
 * Render a single mermaid source string to an SVG string. `id` must be a valid,
 * unique DOM id (Mermaid uses it for internal element ids). On a malformed
 * diagram Mermaid throws; callers decide how to surface that.
 */
export async function renderMermaid(id: string, source: string): Promise<string> {
  ensureInitialised();
  const { svg } = await mermaid.render(id, source);
  return svg;
}
