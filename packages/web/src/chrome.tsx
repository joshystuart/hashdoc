import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { currentTheme, toggleTheme, type Theme } from './theme.js';

type HeaderButtonVariant = 'primary' | 'secondary' | 'icon';

interface AppHeaderProps {
  children: ComponentChildren;
  leading?: ComponentChildren;
  class?: string;
}

interface HeaderButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HeaderButtonVariant;
}

export function AppHeader({ children, leading, class: className = '' }: AppHeaderProps): JSX.Element {
  return (
    <header class={['app-header', className].filter(Boolean).join(' ')}>
      {leading ? <div class="app-header__leading">{leading}</div> : null}
      <div class="app-header__actions">{children}</div>
    </header>
  );
}

export function HeaderToolbar({
  children,
  class: className = '',
  ...props
}: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div class={['app-header__toolbar', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function HeaderButton({
  children,
  class: className = '',
  type = 'button',
  variant = 'secondary',
  ...props
}: HeaderButtonProps): JSX.Element {
  return (
    <button
      {...props}
      type={type}
      class={['app-button', `app-button--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

export function ThemeToggleButton(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const label = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';

  return (
    <HeaderButton
      variant="icon"
      class="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'light' ? '\u{1F319}' : '☀️'}
    </HeaderButton>
  );
}
