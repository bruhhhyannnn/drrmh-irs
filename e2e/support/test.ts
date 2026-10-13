import { test as base } from '@playwright/test';
import { blockWrites, type Writes } from './writes';

export { expect } from '@playwright/test';

/**
 * Playwright's `test`, with writes to the database stopped in every test (see writes.ts).
 * `writes.blocked` lists what a test tried to write; each one is also noted on the report.
 */
export const test = base.extend<{ writes: Writes }>({
  writes: [
    async ({ context }, use, testInfo) => {
      const writes = await blockWrites(context);
      await use(writes);
      for (const name of writes.blocked) {
        testInfo.annotations.push({ type: 'Blocked write', description: name });
      }
    },
    { auto: true },
  ],
});
