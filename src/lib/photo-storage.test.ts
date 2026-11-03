import assert from 'node:assert/strict';
import { test } from 'node:test';

// Storage takes at most 1000 paths per delete (review 3.2.1): a large event's photos go in
// several requests, never one that fails and leaves them all behind.

test('remove deletes in chunks of at most 1000 paths', async () => {
  // supabase-admin.ts builds its client from these at import; no request is made.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test';
  const { supabaseAdmin } = await import('./supabase-admin');
  const { photoBucket } = await import('./photo-storage');

  const calls: string[][] = [];
  Object.defineProperty(supabaseAdmin, 'storage', {
    value: {
      from: () => ({
        remove: async (paths: string[]) => {
          calls.push(paths);
          return { data: [], error: null };
        },
      }),
    },
  });

  const paths = Array.from({ length: 2500 }, (_, i) => `report/${i}.jpg`);
  await photoBucket('report-photos', 1).remove(paths);

  assert.equal(calls.length, 3);
  assert.ok(calls.every((chunk) => chunk.length <= 1000));
  assert.deepEqual(calls.flat(), paths);

  calls.length = 0;
  await photoBucket('report-photos', 1).remove([]);
  assert.equal(calls.length, 0);
});
