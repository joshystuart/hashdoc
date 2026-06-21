import type { JSX, Ref } from 'preact';
import { useState } from 'preact/hooks';
import { Eye, EyeOff } from 'lucide-preact';
import { HEADER_ICON_SIZE } from './chrome.js';

export interface PasswordFieldProps {
  value: string;
  onInput: (value: string) => void;
  autocomplete: string;
  inputClass?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function PasswordField({
  value,
  onInput,
  autocomplete,
  inputClass,
  inputRef,
}: PasswordFieldProps): JSX.Element {
  const [reveal, setReveal] = useState(false);

  return (
    <div class="password-dialog__field">
      <input
        ref={inputRef ?? null}
        class={
          inputClass
            ? `password-dialog__input ${inputClass}`
            : 'password-dialog__input'
        }
        type={reveal ? 'text' : 'password'}
        aria-label="Password"
        placeholder="Password"
        autocomplete={autocomplete}
        value={value}
        onInput={(event) => onInput((event.target as HTMLInputElement).value)}
      />
      <button
        type="button"
        class="password-dialog__reveal"
        aria-label={reveal ? 'Hide password' : 'Show password'}
        aria-pressed={reveal}
        onClick={() => setReveal((current) => !current)}
      >
        {reveal ? (
          <EyeOff size={HEADER_ICON_SIZE} />
        ) : (
          <Eye size={HEADER_ICON_SIZE} />
        )}
      </button>
    </div>
  );
}
