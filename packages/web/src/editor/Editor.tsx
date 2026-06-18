import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { encode, buildLink } from '@portablemd/core';
import { render } from '../render.js';
import { createSourceEditor, type SourceEditor } from './codemirror.js';
import { TOOLBAR_ACTIONS } from './commands.js';

const STARTER_DOC = '# New document\n\nStart writing **markdown** here.\n';

/**
 * The Editor: a CodeMirror source pane + formatting toolbar on the left, a live
 * preview on the right. The preview is produced by the shared {@link render}
 * module — the exact function the Viewer uses — so preview === reader output.
 *
 * "Copy Link" encodes the current document into an origin-relative Link via
 * core's {@link encode}/{@link buildLink} and copies it to the clipboard. The
 * Link *is* the document: nothing is sent anywhere (ADR 0001/0002).
 */
export function Editor(): preact.JSX.Element {
  const sourceHost = useRef<HTMLDivElement>(null);
  const editorRef = useRef<SourceEditor | null>(null);
  const [markdown, setMarkdown] = useState<string>(STARTER_DOC);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Create the CodeMirror instance once the host div is committed. A layout
  // effect (synchronous after render) ensures the source pane exists before any
  // interaction — and keeps tests deterministic without waiting on rAF.
  useLayoutEffect(() => {
    const host = sourceHost.current;
    if (!host) {
      return;
    }
    const editor = createSourceEditor(host, STARTER_DOC, (doc) => {
      setMarkdown(doc);
      setCopyState('idle');
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  async function copyLink(): Promise<void> {
    const link = buildLink(encode(markdown), location.origin + location.pathname);
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  // The preview is the Viewer's exact output: same render(), same markup shape.
  const previewHtml = render(markdown);

  return (
    <div class="editor">
      <header class="editor__bar">
        <div class="editor__toolbar" role="toolbar" aria-label="Formatting">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              class="editor__tool"
              title={action.title}
              aria-label={action.title}
              onClick={() => {
                const view = editorRef.current?.view;
                if (view) {
                  action.run(view);
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div class="editor__actions">
          <button type="button" class="editor__copy" onClick={() => void copyLink()}>
            {copyState === 'copied' ? 'Link copied' : 'Copy Link'}
          </button>
          {copyState === 'failed' ? (
            <span class="editor__copy-status" role="alert">
              Copy failed — your browser blocked clipboard access.
            </span>
          ) : null}
        </div>
      </header>
      <div class="editor__panes">
        <div class="editor__source" ref={sourceHost} aria-label="Markdown source" />
        <article
          class="editor__preview document"
          aria-label="Preview"
          // Preview HTML is already sanitized by render() (DOMPurify).
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
}
