// Theme handling shared by the inline bootstrap script, the provider and every toggle.
export type Theme = 'light' | 'dark';
const KEY = 'cw-theme';

/** Runs before first paint (inlined in the document head) so a visitor never sees the wrong theme. */
export const themeBootstrap = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
export function applyTheme(theme: Theme, remember = true) {
  document.documentElement.dataset.theme = theme;
  if (remember) { try { localStorage.setItem(KEY, theme); } catch { /* the choice lasts for this visit only */ } }
}
export function storedTheme(): Theme | null {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; }
}
