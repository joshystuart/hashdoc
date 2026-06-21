import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Copy, Link2, Lock, SquarePen } from 'lucide-preact';
import { encode, encodeSecure, buildLink } from '@hashdoc/core';
import { AppHeader, HeaderButton, ThemeToggleButton, HEADER_ICON_SIZE } from './chrome.js';
import { copyText } from './render.js';
import { SplitButton, type SplitButtonMenuItem } from './SplitButton.js';
import { PasswordDialog } from './PasswordDialog.js';

interface ViewerChromeProps {
  markdown: string;
  onEdit: () => void;
  securePayload?: string | undefined;
}

function useFlashingLabel(original: string): [string, (message: string) => void] {
  const [label, setLabel] = useState(original);

  return [
    label,
    (message: string) => {
      setLabel(message);
      window.setTimeout(() => {
        setLabel(original);
      }, 2000);
    },
  ];
}

export function ViewerChrome({ markdown, onEdit, securePayload }: ViewerChromeProps) {
  const [sourceLabel, flashSource] = useFlashingLabel('Copy source');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [dialogOpen, setDialogOpen] = useState(false);

  const secured = securePayload !== undefined;
  const base = location.origin + location.pathname;

  function flashCopied(ok: boolean): void {
    setCopyState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 2000);
  }

  function copyPlain(): void {
    void copyText(buildLink(encode(markdown), base)).then(flashCopied);
  }

  function copySecureReemit(): void {
    if (securePayload === undefined) {
      return;
    }
    void copyText(buildLink(securePayload, base)).then(flashCopied);
  }

  async function handleDialogSubmit(password: string): Promise<void> {
    try {
      const payload = await encodeSecure(markdown, password);
      const ok = await copyText(buildLink(payload, base));
      flashCopied(ok);
    } catch {
      flashCopied(false);
    }
    setDialogOpen(false);
  }

  const copiedLabel = copyState === 'copied' ? 'Link copied' : null;
  const primary = secured
    ? { label: copiedLabel ?? 'Copy secure link', icon: Lock, onClick: copySecureReemit }
    : { label: copiedLabel ?? 'Copy Link', icon: Link2, onClick: copyPlain };
  const menuItems: SplitButtonMenuItem[] = secured
    ? [{ label: 'Copy Link', icon: Link2, onClick: copyPlain }]
    : [{ label: 'Copy secure link', icon: Lock, onClick: () => setDialogOpen(true) }];

  return (
    <Fragment>
      <AppHeader class="viewer__chrome">
        <HeaderButton
          class="viewer__action viewer__copy-source"
          title="Copy the raw markdown source"
          onClick={() => {
            void copyText(markdown).then((ok) => {
              flashSource(ok ? 'Copied' : 'Copy failed');
            });
          }}
        >
          <Copy size={HEADER_ICON_SIZE} />
          {sourceLabel}
        </HeaderButton>
        <SplitButton class="viewer__copy" primary={primary} items={menuItems} locked={secured} />
        <HeaderButton
          class="viewer__action viewer__edit"
          title="Edit a copy — your changes make a new link; this one stays unchanged"
          onClick={onEdit}
        >
          <SquarePen size={HEADER_ICON_SIZE} />
          Edit
        </HeaderButton>
        <ThemeToggleButton />
      </AppHeader>
      <PasswordDialog
        open={dialogOpen}
        submitLabel="Copy secure link"
        onSubmit={(password) => void handleDialogSubmit(password)}
        onClose={() => setDialogOpen(false)}
      />
    </Fragment>
  );
}
