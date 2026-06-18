import type { EditorView } from '@codemirror/view';

/**
 * Markdown editing actions used by the formatting toolbar. Each takes the live
 * CodeMirror view and mutates the document via a transaction, keeping the
 * selection sensible afterwards so typing can continue.
 *
 * These are deliberately simple but real: they wrap/insert literal markdown,
 * which the shared {@link render} pipeline then turns into HTML.
 */

/** Wrap the current selection in `before`/`after`, or insert a placeholder. */
function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const text = selected.length > 0 ? selected : placeholder;
  const insert = `${before}${text}${after}`;
  // Select the inner text so the user can keep typing over the placeholder.
  const innerFrom = range.from + before.length;
  const innerTo = innerFrom + text.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: innerFrom, head: innerTo },
  });
  view.focus();
}

/** Ensure the current line starts with `prefix` (e.g. `## `). */
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
  // Put the caret inside the URL parentheses, ready for a paste.
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
