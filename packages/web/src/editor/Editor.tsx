import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { encode, buildLink } from '@portablemd/core';
import { render, enhance } from '../render.js';
import { createSourceEditor, type SourceEditor } from './codemirror.js';
import { TOOLBAR_ACTIONS } from './commands.js';
import { currentTheme, toggleTheme, type Theme } from '../theme.js';

const STARTER_DOC = '# New document\n\nStart writing **markdown** here.\n';

/** Props for the Editor. */
export interface EditorProps {
  /**
   * Markdown to seed the source pane with. When the Editor is opened fresh (no
   * fragment) this is omitted and the starter doc is used. When opened from the
   * Viewer's Edit action it is the decoded markdown of the viewed Document, so
   * the Reader forks a copy (issue-03). Editing it never mutates the opened
   * Link — saving produces a *new* Link.
   */
  initialMarkdown?: string;
  /**
   * True when the Editor was opened by editing an existing Document (a fork),
   * as opposed to authoring a brand-new one. Drives the explicit "new link
   * created — original unchanged" messaging after Copy Link.
   */
  forkedFromDocument?: boolean;
}

/**
 * The Editor: a CodeMirror source pane + formatting toolbar on the left, a live
 * preview on the right. The preview is produced by the shared {@link render}
 * module — the exact function the Viewer uses — so preview === reader output.
 *
 * "Copy Link" encodes the current document into an origin-relative Link via
 * core's {@link encode}/{@link buildLink} and copies it to the clipboard. The
 * Link *is* the document: nothing is sent anywhere (ADR 0001/0002).
 */
export function Editor({ initialMarkdown, forkedFromDocument = false }: EditorProps = {}): preact.JSX.Element {
  const initialDoc = initialMarkdown ?? STARTER_DOC;
  const sourceHost = useRef<HTMLDivElement>(null);
  const previewHost = useRef<HTMLElement>(null);
  const editorRef = useRef<SourceEditor | null>(null);
  const [markdown, setMarkdown] = useState<string>(initialDoc);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Theme toggle (issue-10): mirror <html data-theme> in local state so the
  // button label re-renders on click. A single toggle on the shared shell
  // recolours both the Editor and the Viewer.
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  // Create the CodeMirror instance once the host div is committed. A layout
  // effect (synchronous after render) ensures the source pane exists before any
  // interaction — and keeps tests deterministic without waiting on rAF.
  useLayoutEffect(() => {
    const host = sourceHost.current;
    if (!host) {
      return;
    }
    const editor = createSourceEditor(host, initialDoc, (doc) => {
      setMarkdown(doc);
      setCopyState('idle');
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // initialDoc is captured once at mount; CodeMirror owns the document after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // After each preview render, run the shared enhance step so code blocks are
  // syntax-highlighted exactly as the Viewer highlights them. Preact has
  // committed the new innerHTML by the time this layout effect runs.
  useLayoutEffect(() => {
    const host = previewHost.current;
    if (host) {
      void enhance(host);
    }
  }, [previewHtml]);

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
          <button
            type="button"
            class="theme-toggle"
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={() => setTheme(toggleTheme())}
          >
            {theme === 'light' ? '\u{1F319}' : '☀️'}
          </button>
          <button type="button" class="editor__copy" onClick={() => void copyLink()}>
            {copyState === 'copied' ? 'Link copied' : 'Copy Link'}
          </button>
          {copyState === 'copied' ? (
            <span class="editor__copy-status editor__copy-status--ok" role="status">
              {forkedFromDocument
                ? 'New link created — your edits made a fresh link. The original link is unchanged.'
                : 'New link created — copy it to share this document. Each save makes a fresh link.'}
            </span>
          ) : null}
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
          ref={previewHost}
          // Preview HTML is already sanitized by render() (DOMPurify).
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
}
