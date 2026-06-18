/**
 * Lazy syntax-highlighting island. This module (and everything it imports —
 * the highlight.js core, the bundled language grammars, and the theme CSS) is
 * only ever reached through a dynamic `import()` in {@link enhance}, so Vite
 * code-splits it into a separate async chunk. Documents with no code blocks
 * never load any of it, and it never enters the Viewer entry chunk.
 *
 * We use `highlight.js/lib/core` and register a curated language set rather than
 * the full bundle, keeping the async chunk lean while covering the common cases.
 * The theme is imported locally (no CDN) so ADR 0002 — zero third-party
 * requests — still holds.
 */
import hljs from 'highlight.js/lib/core';

// A pragmatic, common-case language set. Aliases (ts, js, py, sh, yml, …) are
// registered by highlight.js itself, so `language-ts` etc. resolve correctly.
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import shell from 'highlight.js/lib/languages/shell';

// Theme CSS, bundled locally into the app's stylesheet (no external request).
import 'highlight.js/styles/github.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('shell', shell);

/**
 * Highlight a single code block's plain-text source, returning structural-span
 * HTML. Unknown languages (and blocks with no language) are not guessed: the
 * source is HTML-escaped and returned verbatim, so the output is always safe.
 */
export function highlightCode(source: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  }
  // No (or unknown) language: escape only, no auto-detection guessing.
  return escapeHtml(source);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
