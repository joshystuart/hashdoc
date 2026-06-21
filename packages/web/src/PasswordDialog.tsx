import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Eye, EyeOff } from 'lucide-preact';
import { HEADER_ICON_SIZE } from './chrome.js';

export interface PasswordDialogProps {
  open: boolean;
  initialPassword?: string;
  submitLabel: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
}

function openDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) {
    return;
  }
  try {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  } catch {
    void 0;
  }
  if (!dialog.open) {
    dialog.setAttribute('open', '');
  }
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) {
    return;
  }
  try {
    if (typeof dialog.close === 'function') {
      dialog.close();
      if (!dialog.open) {
        return;
      }
    }
  } catch {
    void 0;
  }
  dialog.removeAttribute('open');
}

export function PasswordDialog({
  open,
  initialPassword = '',
  submitLabel,
  onSubmit,
  onClose,
}: PasswordDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initialPassword);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      setValue(initialPassword);
      setReveal(false);
      openDialog(dialog);
    } else {
      closeDialog(dialog);
    }
  }, [open, initialPassword]);

  function handleSubmit(event: Event): void {
    event.preventDefault();
    if (value.length === 0) {
      return;
    }
    onSubmit(value);
  }

  return (
    <dialog
      class="password-dialog"
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <form class="password-dialog__form" onSubmit={handleSubmit}>
        <div class="password-dialog__field">
          <input
            class="password-dialog__input"
            type={reveal ? 'text' : 'password'}
            aria-label="Password"
            placeholder="Password"
            autocomplete="new-password"
            value={value}
            onInput={(event) => setValue((event.target as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="password-dialog__reveal"
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            onClick={() => setReveal((current) => !current)}
          >
            {reveal ? <EyeOff size={HEADER_ICON_SIZE} /> : <Eye size={HEADER_ICON_SIZE} />}
          </button>
        </div>
        <p class="password-dialog__note">
          Share this password separately from the Link — never send both in the same message. If the
          password is lost, the Document is unrecoverable.
        </p>
        <button
          type="submit"
          class="password-dialog__submit app-button app-button--primary"
          disabled={value.length === 0}
        >
          {submitLabel}
        </button>
      </form>
    </dialog>
  );
}
