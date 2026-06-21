import type { ComponentType, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ChevronDown, Lock, type LucideProps } from 'lucide-preact';
import { HEADER_ICON_SIZE } from './chrome.js';

export interface SplitButtonAction {
  label: string;
  icon?: ComponentType<LucideProps>;
  onClick: () => void;
}

export interface SplitButtonMenuItem {
  label: string;
  icon?: ComponentType<LucideProps>;
  onClick: () => void;
  destructive?: boolean;
}

export interface SplitButtonProps {
  primary: SplitButtonAction;
  items: SplitButtonMenuItem[];
  locked?: boolean;
  caretLabel?: string;
  class?: string;
}

export function SplitButton({
  primary,
  items,
  locked = false,
  caretLabel = 'More options',
  class: className = '',
}: SplitButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveIndex(0);
    const id = requestAnimationFrame(() => itemRefs.current[0]?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  function closeAndRestore(): void {
    setOpen(false);
    caretRef.current?.focus();
  }

  function focusItem(index: number): void {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestore();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem((activeIndex + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem((activeIndex - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  }

  const PrimaryIcon = locked ? Lock : primary.icon;
  const buttonClass = [
    'app-button',
    locked ? 'app-button--secure' : 'app-button--primary',
  ].join(' ');

  return (
    <div
      class={['split-button', locked ? 'split-button--secure' : '', className]
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <button
        type="button"
        class={`split-button__primary ${buttonClass}`}
        onClick={primary.onClick}
      >
        {PrimaryIcon ? <PrimaryIcon size={HEADER_ICON_SIZE} /> : null}
        {primary.label}
      </button>
      <button
        type="button"
        class={`split-button__caret ${buttonClass}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={caretLabel}
        ref={caretRef}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={HEADER_ICON_SIZE} />
      </button>
      {open ? (
        <div class="split-button__menu" role="menu" onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={index === activeIndex ? 0 : -1}
                class={[
                  'split-button__item',
                  item.destructive ? 'split-button__item--destructive' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                ref={(el) => {
                  itemRefs.current[index] = el as HTMLButtonElement | null;
                }}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {ItemIcon ? <ItemIcon size={HEADER_ICON_SIZE} /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
