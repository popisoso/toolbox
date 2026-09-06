/**
 * Theme plumbing. Reads tokens; never defines them. Keeps the browser chrome
 * (theme-color meta) in sync with --color-bg so the manifest is the only
 * other place a colour is written down.
 */
export const THEME_STORAGE = 'toolbox.theme';
export type ThemeChoice = 'system' | 'light' | 'dark';

export function getThemeChoice(): ThemeChoice {
  try { return (localStorage.getItem(THEME_STORAGE) as ThemeChoice) || 'system'; } catch { return 'system'; }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = choice;
  try { localStorage.setItem(THEME_STORAGE, choice); } catch { /* ignore */ }
  syncThemeColor();
}

export function syncThemeColor(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  if (bg) meta.content = bg;
}

export function initTheme(): void {
  applyTheme(getThemeChoice());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);
}
