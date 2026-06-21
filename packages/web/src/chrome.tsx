import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Moon, Sun } from 'lucide-preact';
import { currentTheme, toggleTheme, type Theme } from './theme.js';

export const HEADER_ICON_SIZE = 18;

const LOGO_SRC = `${import.meta.env.BASE_URL}hashdoc-logo.svg`;

type HeaderButtonVariant = 'primary' | 'secondary' | 'icon';

interface AppHeaderProps {
  children: ComponentChildren;
  leading?: ComponentChildren;
  class?: string;
}

interface HeaderButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HeaderButtonVariant;
}

export function AppHeader({
  children,
  leading,
  class: className = '',
}: AppHeaderProps): JSX.Element {
  return (
    <header class={['app-header', className].filter(Boolean).join(' ')}>
      <div class="app-header__leading">
        <HeaderLogo />
        {leading}
      </div>
      <div class="app-header__actions">{children}</div>
    </header>
  );
}

export function HeaderLogo(): JSX.Element {
  return (
    <div class="app-header__logo" aria-hidden="true">
      <img src={LOGO_SRC} alt="" width={36} height={36} decoding="async" />
    </div>
  );
}

export function HeaderToolbar({
  children,
  class: className = '',
  ...props
}: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      class={['app-header__toolbar', className].filter(Boolean).join(' ')}
      {...props}
    >
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
      class={['app-button', `app-button--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

export function ThemeToggleButton(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const label =
    theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';

  return (
    <HeaderButton
      variant="icon"
      class="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'light' ? (
        <Moon size={HEADER_ICON_SIZE} />
      ) : (
        <Sun size={HEADER_ICON_SIZE} />
      )}
    </HeaderButton>
  );
}
