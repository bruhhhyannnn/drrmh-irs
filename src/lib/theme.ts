// Light / dark mode. The choice is kept per device in localStorage; 'system' (the default)
// follows the device setting. Dark mode is the `dark` class on <html>, which the colour tokens
// in globals.css (and the vendored map) read.

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'irs-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage blocked (private mode, sandboxed frame): fall back to the device setting.
  }
  return 'system';
}

export function prefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function watchSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Runs in <head> before the first paint (see the root layout), so a saved dark theme doesn't
 * flash light while the app loads. Mirrors `readThemePreference` + `applyTheme`.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY
)}).matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
