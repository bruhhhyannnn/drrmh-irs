// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyTheme, readThemePreference, THEME_SCRIPT, THEME_STORAGE_KEY } from './theme';

/** Makes the device report a dark (or light) colour scheme. */
function deviceIsDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const isDark = () => document.documentElement.classList.contains('dark');

describe('readThemePreference', () => {
  it('follows the device unless light or dark was saved', () => {
    expect(readThemePreference()).toBe('system');

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readThemePreference()).toBe('dark');

    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemePreference()).toBe('system');
  });

  it('falls back to the device when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(readThemePreference()).toBe('system');
  });
});

describe('applyTheme', () => {
  it.each([
    ['light', true, false],
    ['dark', false, true],
    ['system', true, true],
    ['system', false, false],
  ] as const)('%s with a dark=%s device sets dark to %s', (preference, deviceDark, expected) => {
    deviceIsDark(deviceDark);
    applyTheme(preference);
    expect(isDark()).toBe(expected);
  });
});

describe('THEME_SCRIPT', () => {
  // The inline script runs before React; it has to reach the same answer as applyTheme.
  it.each([
    [null, true, true],
    [null, false, false],
    ['light', true, false],
    ['dark', false, true],
  ])('with %j saved on a dark=%s device sets dark to %s', (saved, deviceDark, expected) => {
    deviceIsDark(deviceDark);
    if (saved) localStorage.setItem(THEME_STORAGE_KEY, saved);
    document.documentElement.classList.toggle('dark', !expected);

    new Function(THEME_SCRIPT)();

    expect(isDark()).toBe(expected);
  });
});
