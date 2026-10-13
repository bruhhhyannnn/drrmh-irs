import { afterEach, vi } from 'vitest';

// next/font only works inside Next's compiler. The design-system barrel loads the fonts, so
// anything importing `@/components/ds` would fail without this; tests get empty class names.
vi.mock('next/font/google', () => {
  const font = () => ({ className: '', variable: '', style: { fontFamily: '' } });
  return { Figtree: font, Inter: font, Spline_Sans_Mono: font };
});

// The rest is for tests running in jsdom; Node tests skip it.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // jsdom has no matchMedia; the drawers and the theme read it. Nothing matches unless a test
  // stubs it.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
