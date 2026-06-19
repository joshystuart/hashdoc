import { render as preactRender } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { encode, buildLink, linkSizeWarning } from '@openartifact/core';
import { render, enhance } from '../render.js';
import { createSourceEditor, type SourceEditor } from './codemirror.js';
import { TOOLBAR_ACTIONS } from './commands.js';
import { classifyImages } from './images.js';
import { EXAMPLE_DOC } from './example.js';
import { AppHeader, HeaderButton, HeaderToolbar, ThemeToggleButton } from '../chrome.js';

export interface EditorProps {
  initialMarkdown?: string;
  forkedFromDocument?: boolean;
}

export function Editor({ initialMarkdown }: EditorProps = {}): preact.JSX.Element {
  const initialDoc = initialMarkdown ?? EXAMPLE_DOC;
  const rootRef = useRef<HTMLDivElement>(null);
  const sourceHost = useRef<HTMLDivElement>(null);
  const previewHost = useRef<HTMLElement>(null);
  const editorRef = useRef<SourceEditor | null>(null);
  const [markdown, setMarkdown] = useState<string>(initialDoc);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = buildLink(encode(markdown), location.origin + location.pathname);

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  function openView(): void {
    const root = rootRef.current?.parentElement;
    if (!root) {
      return;
    }
    history.pushState(null, '', link);
    preactRender(null, root);
    void import('../viewer.js').then(({ mountViewer }) => {
      mountViewer(root, link);
    });
  }

  const characters = link.length;
  const sizeWarning = linkSizeWarning(characters);
  const images = classifyImages(markdown);
  const previewHtml = render(markdown);

  useLayoutEffect(() => {
    const host = previewHost.current;
    if (host) {
      void enhance(host);
    }
  }, [previewHtml]);

  return (
    <div class="editor" ref={rootRef}>
      <AppHeader
        class="editor__bar"
        leading={
          <HeaderToolbar class="editor__toolbar" role="toolbar" aria-label="Formatting">
            {TOOLBAR_ACTIONS.map((action) => (
              <HeaderButton
                key={action.id}
                variant="icon"
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
              </HeaderButton>
            ))}
          </HeaderToolbar>
        }
      >
        <div class="editor__actions">
          <HeaderButton variant="primary" class="editor__copy" onClick={() => void copyLink()}>
            {copyState === 'copied' ? 'Link copied' : 'Copy Link'}
          </HeaderButton>
          <HeaderButton class="editor__view" onClick={openView}>
            View
          </HeaderButton>
          <ThemeToggleButton />
        </div>
      </AppHeader>
      <div class="editor__status">
        <span class="editor__size">{characters.toLocaleString()} characters</span>
        {copyState === 'failed' ? (
          <span class="editor__copy-status" role="alert">
            Copy failed — your browser blocked clipboard access.
          </span>
        ) : null}
        {sizeWarning ? (
          <p class="editor__size-warning editor__warning" role="status">
            {sizeWarning}
          </p>
        ) : null}
        {images.any ? (
          <p class="editor__image-warning editor__warning" role="status">
            This Document embeds {images.data && !images.remote ? 'an image' : 'images'}.{' '}
            {images.data
              ? 'Inline (data-URI) images are stored inside the Link, so they inflate its size quickly. '
              : 'Images add to the size of the Link. '}
            {images.remote
              ? 'Remote images are also the one exception to "no third-party requests" (ADR 0002): the reader’s browser fetches them, revealing the reader’s IP address to the image host.'
              : ''}
          </p>
        ) : null}
      </div>
      <div class="editor__panes">
        <div class="editor__source" ref={sourceHost} aria-label="Markdown source" />
        <article
          class="editor__preview document"
          aria-label="Preview"
          ref={previewHost}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
}
