import { render as preactRender } from 'preact';
import type { ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Bold, Code, Eye, Heading, Italic, Link2, type LucideProps } from 'lucide-preact';
import { encode, encodeSecure, buildLink, linkSizeWarning } from '@hashdoc/core';
import { render, enhance } from '../render.js';
import { createSourceEditor, type SourceEditor } from './codemirror.js';
import { TOOLBAR_ACTIONS } from './commands.js';
import { classifyImages } from './images.js';
import { EXAMPLE_DOC } from './example.js';
import { AppHeader, HeaderButton, HeaderToolbar, ThemeToggleButton, HEADER_ICON_SIZE } from '../chrome.js';

const TOOLBAR_ICONS: Record<string, ComponentType<LucideProps>> = {
  bold: Bold,
  italic: Italic,
  heading: Heading,
  link: Link2,
  code: Code,
};

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
  const [secure, setSecure] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [secureLink, setSecureLink] = useState<string | null>(null);

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

  const base = location.origin + location.pathname;
  const plainLink = buildLink(encode(markdown), base);
  const secureReady = secure && password.length > 0 && password === confirm;

  useEffect(() => {
    if (!secureReady) {
      setSecureLink(null);
      return;
    }
    let ignore = false;
    void encodeSecure(markdown, password).then((payload) => {
      if (!ignore) {
        setSecureLink(buildLink(payload, base));
      }
    });
    return () => {
      ignore = true;
    };
  }, [secureReady, markdown, password, base]);

  const link = secure ? secureLink : plainLink;

  const secureMessage = !secure
    ? null
    : password.length === 0
      ? 'Enter a password to secure this Document.'
      : password !== confirm
        ? 'Passwords do not match.'
        : null;

  async function copyLink(): Promise<void> {
    if (link === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  function openView(): void {
    if (link === null) {
      return;
    }
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

  const characters = (link ?? plainLink).length;
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
            {TOOLBAR_ACTIONS.map((action) => {
              const Icon = TOOLBAR_ICONS[action.id];
              return (
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
                  {Icon ? <Icon size={HEADER_ICON_SIZE} /> : action.label}
                </HeaderButton>
              );
            })}
          </HeaderToolbar>
        }
      >
        <div class="editor__actions">
          <HeaderButton variant="primary" class="editor__copy" onClick={() => void copyLink()}>
            <Link2 size={HEADER_ICON_SIZE} />
            {copyState === 'copied' ? 'Link copied' : 'Copy Link'}
          </HeaderButton>
          <HeaderButton class="editor__view" onClick={openView}>
            <Eye size={HEADER_ICON_SIZE} />
            View
          </HeaderButton>
          <ThemeToggleButton />
        </div>
      </AppHeader>
      <div class="editor__status">
        <div class="editor__secure">
          <label class="editor__secure-toggle">
            <input
              type="checkbox"
              class="editor__secure-checkbox"
              checked={secure}
              onChange={(event) => {
                setSecure((event.target as HTMLInputElement).checked);
                setCopyState('idle');
              }}
            />
            Secure with password
          </label>
          {secure ? (
            <div class="editor__secure-fields">
              <input
                type="password"
                class="editor__password"
                aria-label="Password"
                placeholder="Password"
                autocomplete="new-password"
                value={password}
                onInput={(event) => {
                  setPassword((event.target as HTMLInputElement).value);
                  setCopyState('idle');
                }}
              />
              <input
                type="password"
                class="editor__confirm"
                aria-label="Confirm password"
                placeholder="Confirm password"
                autocomplete="new-password"
                value={confirm}
                onInput={(event) => {
                  setConfirm((event.target as HTMLInputElement).value);
                  setCopyState('idle');
                }}
              />
              <p class="editor__secure-note">
                Share this password separately from the Link — never send both in the same message.
                If the password is lost, the Document is unrecoverable.
              </p>
              {secureMessage ? (
                <p class="editor__secure-error editor__warning" role="alert">
                  {secureMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
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
