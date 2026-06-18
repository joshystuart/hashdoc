import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

/** A live CodeMirror source editor plus a teardown handle. */
export interface SourceEditor {
  readonly view: EditorView;
  destroy(): void;
}

/**
 * Mount a CodeMirror 6 markdown editor inside `parent`, seeded with `doc`.
 * `onChange` fires with the full document text whenever it changes, driving the
 * live preview. CodeMirror is heavy, which is why this whole module (and its
 * imports) lives behind the Editor's dynamic import.
 */
export function createSourceEditor(
  parent: HTMLElement,
  doc: string,
  onChange: (doc: string) => void,
): SourceEditor {
  const state = EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });
  const view = new EditorView({ state, parent });
  return {
    view,
    destroy: () => view.destroy(),
  };
}
