import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flushOne } from './offline-flush';
import type { QueuedEntry } from './offline-queue';

// Replaying one offline queue (review I1): entries that aren't the signed-in account's are
// skipped, so they neither block its own entries nor get marked failed.

type Payload = { evaluator_id: string };

const entry = (id: string, evaluator: string): QueuedEntry<Payload> => ({
  id,
  createdAt: 0,
  payload: { evaluator_id: evaluator },
  status: 'pending',
});

function memoryQueue(entries: QueuedEntry<Payload>[]) {
  const rows = new Map(entries.map((e) => [e.id, { ...e }]));
  return {
    rows,
    getAll: async () => [...rows.values()],
    remove: async (id: string) => {
      rows.delete(id);
    },
    markFailed: async (id: string, errorMessage: string) => {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, status: 'failed', errorMessage });
    },
  };
}

test("another account's waiting entry doesn't block or fail; own entries send", async () => {
  const q = memoryQueue([entry('1', 'A'), entry('2', 'B'), entry('3', 'B')]);
  const sent: string[] = [];
  const result = await flushOne(
    q.getAll,
    q.remove,
    q.markFailed,
    async (payload: Payload) => {
      if (payload.evaluator_id !== 'B') throw new TypeError('belongs to another account');
      sent.push(payload.evaluator_id);
    },
    (e) => e.payload.evaluator_id === 'B'
  );
  assert.deepEqual(result, { synced: 2, failed: 0 });
  assert.deepEqual(sent, ['B', 'B']);
  assert.deepEqual(
    [...q.rows.values()].map((r) => [r.id, r.status]),
    [['1', 'pending']]
  );
});

test('a network error stops the flush; a rejection marks the entry failed', async () => {
  const q = memoryQueue([entry('1', 'B'), entry('2', 'B'), entry('3', 'B')]);
  let calls = 0;
  const result = await flushOne(q.getAll, q.remove, q.markFailed, async () => {
    calls += 1;
    if (calls === 1) throw new Error('That building is no longer available.');
    throw new TypeError('Failed to fetch');
  });
  assert.deepEqual(result, { synced: 0, failed: 1 });
  assert.equal(calls, 2);
  assert.equal(q.rows.get('1')?.status, 'failed');
  assert.equal(q.rows.get('3')?.status, 'pending');
});
