import { render as preactRender } from 'preact';
import type { ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  Bold,
  Code,
  Eye,
  Heading,
  Italic,
  KeyRound,
  Link2,
  Lock,
  Unlock,
  type LucideProps,
} from 'lucide-preact';
import { encode, encodeSecure, buildLink, linkSizeWarning } from '@hashdoc/core';
import { render, enhance } from '../render.js';
import { createSourceEditor, type SourceEditor } from './codemirror.js';
import { TOOLBAR_ACTIONS } from './commands.js';
import { classifyImages } from './images.js';
import { EXAMPLE_DOC } from './example.js';
import { AppHeader, HeaderButton, HeaderToolbar, ThemeToggleButton, HEADER_ICON_SIZE } from '../chrome.js';
import { SplitButton, type SplitButtonMenuItem } from '../SplitButton.js';
import { PasswordDialog } from '../PasswordDialog.js';

const TOOLBAR_ICONS: Record<string, ComponentType<LucideProps>> = {
  bold: Bold,
  italic: Italic,
  heading: Heading,
  link: Link2,
  code: Code,
};

type DialogMode = 'copy' | 'save';

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
  const [securePassword, setSecurePassword] = useState<string | null>(null);
  const [secureLink, setSecureLink] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('copy');

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

  useEffect(() => {
    if (securePassword === null) {
      setSecureLink(null);
      return;
    }
    let ignore = false;
    setSecureLink(null);
    void encodeSecure(markdown, securePassword).then((payload) => {
      if (!ignore) {
        setSecureLink(buildLink(payload, base));
      }
    });
    return () => {
      ignore = true;
    };
  }, [securePassword, markdown, base]);

  const activeLink = securePassword === null ? plainLink : secureLink;

  async function writeClipboard(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  function copyPlain(): void {
    void writeClipboard(plainLink);
  }

  function copySecure(): void {
    if (secureLink === null) {
      return;
    }
    void writeClipboard(secureLink);
  }

  function openCopyDialog(): void {
    setDialogMode('copy');
    setDialogOpen(true);
  }

  function openChangeDialog(): void {
    setDialogMode('save');
    setDialogOpen(true);
  }

  function removePassword(): void {
    setSecurePassword(null);
    setCopyState('idle');
  }

  async function handleDialogSubmit(password: string): Promise<void> {
    if (dialogMode === 'copy') {
      setSecurePassword(password);
      try {
        const payload = await encodeSecure(markdown, password);
        const link = buildLink(payload, base);
        await navigator.clipboard.writeText(link);
        setSecureLink(link);
        setCopyState('copied');
      } catch {
        setCopyState('failed');
      }
    } else {
      setSecureLink(null);
      setSecurePassword(password);
    }
    setDialogOpen(false);
  }

  function openView(): void {
    if (activeLink === null) {
      return;
    }
    const root = rootRef.current?.parentElement;
    if (!root) {
      return;
    }
    history.pushState(null, '', activeLink);
    preactRender(null, root);
    void import('../viewer.js').then(({ mountViewer }) => {
      mountViewer(root, activeLink);
    });
  }

  const copiedLabel = copyState === 'copied' ? 'Link copied' : null;
  const secured = securePassword !== null;
  const primary = secured
    ? { label: copiedLabel ?? 'Copy secure link', icon: Lock, onClick: copySecure }
    : { label: copiedLabel ?? 'Copy Link', icon: Link2, onClick: copyPlain };
  const menuItems: SplitButtonMenuItem[] = secured
    ? [
        { label: 'Copy Link', icon: Link2, onClick: copyPlain },
        { label: 'Change password…', icon: KeyRound, onClick: openChangeDialog },
        { label: 'Remove password', icon: Unlock, onClick: removePassword, destructive: true },
      ]
    : [{ label: 'Copy secure link', icon: Lock, onClick: openCopyDialog }];

  const characters = (activeLink ?? plainLink).length;
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
          <SplitButton class="editor__copy" primary={primary} items={menuItems} locked={secured} />
          <HeaderButton class="editor__view" onClick={openView}>
            <Eye size={HEADER_ICON_SIZE} />
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
      <PasswordDialog
        open={dialogOpen}
        initialPassword={dialogMode === 'save' ? securePassword ?? '' : ''}
        submitLabel={dialogMode === 'save' ? 'Save' : 'Copy secure link'}
        onSubmit={(password) => void handleDialogSubmit(password)}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
