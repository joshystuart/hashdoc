import mermaid from 'mermaid';

let initialisedTheme: 'light' | 'dark' | null = null;

function currentTheme(): 'light' | 'dark' {
  try {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function ensureInitialised(): void {
  const theme = currentTheme();
  if (initialisedTheme === theme) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
  });
  initialisedTheme = theme;
}

export async function renderMermaid(id: string, source: string): Promise<string> {
  ensureInitialised();
  const { svg } = await mermaid.render(id, source);
  return svg;
}
