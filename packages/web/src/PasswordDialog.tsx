import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { PasswordField } from './PasswordField.js';

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      setValue(initialPassword);
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
        <PasswordField
          key={open ? 'open' : 'closed'}
          value={value}
          onInput={setValue}
          autocomplete="new-password"
        />
        <p class="password-dialog__note">
          Share this password separately from the Link — never send both in the
          same message. If the password is lost, the Document is unrecoverable.
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
