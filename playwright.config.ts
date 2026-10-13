import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { ADMIN_STATE } from './e2e/support/admin';

// Browser end-to-end tests. They run against the dev database but never write to it: every
// server action that isn't a `get…` read is stopped in the browser (see e2e/support/writes.ts).
// Unit tests are Vitest's (`npm run test`).

// E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for the signed-in tests live with the other secrets.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const PORT = 3000;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The dev server compiles each page on its first visit; a few workers keep that from piling up.
  workers: 3,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'Asia/Manila',
    // A service worker's requests skip the write guard, so none may register.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: 'auth.setup.ts' },
    {
      name: 'public',
      testMatch: 'public/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testMatch: 'admin/**/*.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
    },
  ],
  // Next runs one dev server per folder, so the tests use yours when `npm run dev` is up and
  // start it when it isn't. To test a production build, run `npm run build` and `npm start`
  // first; that server is reused the same way.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
