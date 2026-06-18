import { render as preactRender, h } from 'preact';
import { Editor } from './Editor.js';

/**
 * Mount the Editor into `root`. This is the single export the rest of the app
 * reaches via dynamic `import()`, so Preact, CodeMirror and the Editor UI all
 * land in a separate async chunk and never bloat the Viewer entry.
 */
export function mountEditor(root: HTMLElement): void {
  preactRender(h(Editor, {}), root);
}
