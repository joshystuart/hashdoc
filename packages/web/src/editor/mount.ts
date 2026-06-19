import { render as preactRender, h } from 'preact';
import { Editor, type EditorProps } from './Editor.js';

export function mountEditor(root: HTMLElement, props: EditorProps = {}): void {
  preactRender(h(Editor, props), root);
}
