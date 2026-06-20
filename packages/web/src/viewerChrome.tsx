import { useState } from 'preact/hooks';
import { Copy, Link2, SquarePen } from 'lucide-preact';
import { encode, buildLink } from '@hashdoc/core';
import { AppHeader, HeaderButton, ThemeToggleButton, HEADER_ICON_SIZE } from './chrome.js';
import { copyText } from './render.js';

interface ViewerChromeProps {
  markdown: string;
  onEdit: () => void;
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

export function ViewerChrome({ markdown, onEdit }: ViewerChromeProps) {
  const [sourceLabel, flashSource] = useFlashingLabel('Copy source');
  const [linkLabel, flashLink] = useFlashingLabel('Copy Link');

  return (
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
      <HeaderButton
        variant="primary"
        class="viewer__action viewer__copy-link"
        title="Copy a link to this document"
        onClick={() => {
          const link = buildLink(encode(markdown), location.origin + location.pathname);
          void copyText(link).then((ok) => {
            flashLink(ok ? 'Link copied' : 'Copy failed');
          });
        }}
      >
        <Link2 size={HEADER_ICON_SIZE} />
        {linkLabel}
      </HeaderButton>
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
  );
}
