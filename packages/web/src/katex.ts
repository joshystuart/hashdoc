/**
 * Lazy KaTeX island. This module (and everything it imports — the KaTeX library
 * and its CSS, which in turn references the bundled font files) is only ever
 * reached through a dynamic `import()` in {@link enhance}, so Vite code-splits
 * it into a separate async chunk. Documents with no math never load any of it,
 * and it never enters the Viewer entry chunk.
 *
 * KaTeX's CSS is imported locally so Vite bundles it AND fingerprints the font
 * files it references via relative `url()` — no CDN request, so ADR 0002 (zero
 * third-party requests) still holds.
 *
 * Security: KaTeX runs with `trust: false` (its default), so `\href`, `\url`,
 * `\includegraphics` and other potentially-dangerous commands are NOT honoured.
 * On a malformed expression it throws (`throwOnError: true`) and the caller
 * leaves the inert placeholder in place. The HTML KaTeX emits is STILL run back
 * through DOMPurify in {@link enhance} before it touches the live DOM — defence
 * in depth, no DOMPurify bypass even from KaTeX's own output.
 */
import katex from 'katex';

// Theme/layout CSS, bundled locally into the app's stylesheet. Vite rewrites the
// `url(fonts/…)` references to local, fingerprinted asset URLs (no external
// request).
import 'katex/dist/katex.min.css';

/**
 * Render a single TeX expression to KaTeX HTML. `displayMode` toggles block
 * (`$$…$$`) vs inline (`$…$`) layout. KaTeX throws on a malformed expression;
 * callers decide how to surface that (we leave the inert source in place).
 */
export function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    // Never honour \href/\url/\includegraphics etc. — keep output inert.
    trust: false,
    throwOnError: true,
    output: 'htmlAndMathml',
  });
}
