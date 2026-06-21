import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Copy, Link2, Lock, SquarePen } from 'lucide-preact';
import { encode, encodeSecure, buildLink } from '@hashdoc/core';
import {
  AppHeader,
  HeaderButton,
  ThemeToggleButton,
  HEADER_ICON_SIZE,
} from './chrome.js';
import { copyText } from './render.js';
import { SplitButton, type SplitButtonMenuItem } from './SplitButton.js';
import { PasswordDialog } from './PasswordDialog.js';
import type { SecureMode, SecureSession } from './secureSession.js';

interface ViewerChromeProps {
  markdown: string;
  onEdit: (session: SecureSession) => void;
  session?: SecureSession | undefined;
}

function useFlashingLabel(
  original: string,
): [string, (message: string) => void] {
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

export function ViewerChrome({ markdown, onEdit, session }: ViewerChromeProps) {
  const [sourceLabel, flashSource] = useFlashingLabel('Copy source');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(
    session?.password ?? null,
  );
  const [originalPayload] = useState<string | undefined>(session?.payload);
  const [encryptedLink, setEncryptedLink] = useState<string | null>(null);
  const [mode, setMode] = useState<SecureMode>(
    session?.mode === 'secure' ? 'secure' : 'plain',
  );

  const base = location.origin + location.pathname;
  const reemitLink =
    originalPayload !== undefined ? buildLink(originalPayload, base) : null;
  const secureLink = reemitLink ?? encryptedLink;

  useEffect(() => {
    if (originalPayload !== undefined || sessionPassword === null) {
      setEncryptedLink(null);
      return;
    }
    let ignore = false;
    setEncryptedLink(null);
    void encodeSecure(markdown, sessionPassword).then((payload) => {
      if (!ignore) {
        setEncryptedLink(buildLink(payload, base));
      }
    });
    return () => {
      ignore = true;
    };
  }, [originalPayload, sessionPassword, markdown, base]);

  function flashCopied(ok: boolean): void {
    setCopyState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 2000);
  }

  function copyPlain(): void {
    setMode('plain');
    void copyText(buildLink(encode(markdown), base)).then(flashCopied);
  }

  function copySecure(): void {
    if (secureLink === null) {
      return;
    }
    void copyText(secureLink).then(flashCopied);
  }

  function chooseSecure(): void {
    if (sessionPassword === null && originalPayload === undefined) {
      setDialogOpen(true);
      return;
    }
    setMode('secure');
    if (secureLink !== null) {
      void copyText(secureLink).then(flashCopied);
    }
  }

  async function handleDialogSubmit(password: string): Promise<void> {
    setSessionPassword(password);
    setMode('secure');
    try {
      const payload = await encodeSecure(markdown, password);
      const link = buildLink(payload, base);
      setEncryptedLink(link);
      flashCopied(await copyText(link));
    } catch {
      flashCopied(false);
    }
    setDialogOpen(false);
  }

  const copiedLabel = copyState === 'copied' ? 'Link copied' : null;
  const secured = mode === 'secure';
  const primary = secured
    ? {
        label: copiedLabel ?? 'Copy secure link',
        icon: Lock,
        onClick: copySecure,
      }
    : { label: copiedLabel ?? 'Copy Link', icon: Link2, onClick: copyPlain };
  const menuItems: SplitButtonMenuItem[] = secured
    ? [{ label: 'Copy Link', icon: Link2, onClick: copyPlain }]
    : [{ label: 'Copy secure link', icon: Lock, onClick: chooseSecure }];

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
        <SplitButton
          class="viewer__copy"
          primary={primary}
          items={menuItems}
          locked={secured}
        />
        <HeaderButton
          class="viewer__action viewer__edit"
          title="Edit a copy — your changes make a new link; this one stays unchanged"
          onClick={() => onEdit({ mode, password: sessionPassword })}
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
