'use client';

import { applyTheme, readThemePreference, THEME_STORAGE_KEY, watchSystemTheme } from '@/lib/theme';
import { useThemeStore } from '@/store';
import { useEffect, useLayoutEffect } from 'react';

/**
 * Keeps the `dark` class on <html> in step with the theme preference: when it changes, when the
 * device setting changes under 'system', and when another tab picks a theme. Layout effect, so
 * the class is back before paint after React's dev remount resets <html>.
 */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference);

  useLayoutEffect(() => {
    applyTheme(preference);
    if (preference !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [preference]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        useThemeStore.setState({ preference: readThemePreference() });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}
