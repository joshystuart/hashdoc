import { render as preactRender, h } from 'preact';
import { Editor, type EditorProps } from './Editor.js';

/**
 * Mount the Editor into `root`. This is the single export the rest of the app
 * reaches via dynamic `import()`, so Preact, CodeMirror and the Editor UI all
 * land in a separate async chunk and never bloat the Viewer entry.
 *
 * `props` carries the optional seed for the source pane: the no-fragment new
 * path omits it (starter doc); the Viewer's Edit action passes the decoded
 * markdown of the viewed Document plus `forkedFromDocument` so the fork is
 * surfaced explicitly (issue-03).
 */
export function mountEditor(root: HTMLElement, props: EditorProps = {}): void {
  preactRender(h(Editor, props), root);
}
