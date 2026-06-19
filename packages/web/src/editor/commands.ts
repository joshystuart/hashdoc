import type { EditorView } from '@codemirror/view';

function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const text = selected.length > 0 ? selected : placeholder;
  const insert = `${before}${text}${after}`;
  const innerFrom = range.from + before.length;
  const innerTo = innerFrom + text.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: innerFrom, head: innerTo },
  });
  view.focus();
}

function prefixLine(view: EditorView, prefix: string): void {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  const insert = `${prefix}${line.text}`;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    selection: { anchor: range.from + prefix.length },
  });
  view.focus();
}

export function toggleBold(view: EditorView): void {
  wrapSelection(view, '**', '**', 'bold text');
}

export function toggleItalic(view: EditorView): void {
  wrapSelection(view, '_', '_', 'italic text');
}

export function toggleInlineCode(view: EditorView): void {
  wrapSelection(view, '`', '`', 'code');
}

export function insertHeading(view: EditorView): void {
  prefixLine(view, '## ');
}

export function insertLink(view: EditorView): void {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const text = selected.length > 0 ? selected : 'link text';
  const insert = `[${text}](https://)`;
  const urlPos = range.from + `[${text}](`.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: urlPos, head: urlPos + 'https://'.length },
  });
  view.focus();
}

export interface ToolbarAction {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly run: (view: EditorView) => void;
}

export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { id: 'bold', label: 'B', title: 'Bold', run: toggleBold },
  { id: 'italic', label: 'I', title: 'Italic', run: toggleItalic },
  { id: 'heading', label: 'H', title: 'Heading', run: insertHeading },
  { id: 'link', label: 'Link', title: 'Link', run: insertLink },
  { id: 'code', label: 'Code', title: 'Inline code', run: toggleInlineCode },
];
