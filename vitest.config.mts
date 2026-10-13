import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit and component tests (`*.test.ts(x)` next to the code). The browser end-to-end tests are
// Playwright's (`e2e/*.spec.ts`, see playwright.config.ts).

// Dates are formatted in the reader's time zone; pin Philippine time so the formatting tests
// give the same text on every machine.
process.env.TZ = 'Asia/Manila';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Tests that need a DOM (components, localStorage, IndexedDB) start with
    // `// @vitest-environment jsdom`; the rest run in plain Node, which starts much faster.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // `@/lib` creates the Supabase client on import. Point it at a local address that isn't
    // there, so a test that forgets to mock it fails fast instead of reaching a real project.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'test-publishable-key',
    },
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
