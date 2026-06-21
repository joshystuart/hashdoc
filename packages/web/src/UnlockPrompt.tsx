import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { PasswordField } from './PasswordField.js';

export type UnlockOutcome = 'wrong-password' | 'handled';

export interface UnlockPromptProps {
  onSubmit: (password: string) => Promise<UnlockOutcome>;
}

export function UnlockPrompt({ onSubmit }: UnlockPromptProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const password = inputRef.current?.value ?? value;
    if (password.length === 0) {
      return;
    }
    setError(null);
    const outcome = await onSubmit(password);
    if (outcome === 'wrong-password') {
      setError('Incorrect password. Please try again.');
      setValue('');
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }
  }

  return (
    <section class="unlock">
      <h1>This Document is secure</h1>
      <p>Enter the password to open it.</p>
      <form class="unlock__form" onSubmit={(event) => void handleSubmit(event)}>
        <PasswordField
          value={value}
          onInput={setValue}
          autocomplete="current-password"
          inputClass="unlock__password"
          inputRef={inputRef}
        />
        <button type="submit" class="unlock__submit app-button app-button--primary">
          Unlock
        </button>
        <p class="unlock__error" hidden={error === null}>
          {error}
        </p>
      </form>
    </section>
  );
}
