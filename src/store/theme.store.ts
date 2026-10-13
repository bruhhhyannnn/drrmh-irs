import { readThemePreference, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';
import { create } from 'zustand';

interface ThemeState {
  /** Light, Dark, or 'system' to follow the device. Saved on this device only. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

// ThemeSync (in Providers) applies the preference to <html>; the script in the root layout has
// already applied the saved one before the first paint.
export const useThemeStore = create<ThemeState>((set) => ({
  preference: typeof window === 'undefined' ? 'system' : readThemePreference(),
  setPreference: (preference) => {
    try {
      if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage blocked: the choice still applies until the page reloads.
    }
    set({ preference });
  },
}));
