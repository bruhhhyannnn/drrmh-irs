import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cachedFetch, withTimeout } from './offline-cache';
import { isNetworkError } from './offline-queue';

// The assessment form's offline cache (review I4): on a weak signal the cached copy is used
// after a short wait instead of waiting on the network forever.

const never = <T>() => new Promise<T>(() => {});

function store(initial?: string) {
  let value = initial;
  return {
    read: async () => value,
    write: async (v: string) => {
      value = v;
    },
    current: () => value,
  };
}

test('a slow network falls back to the cached copy', async () => {
  const s = store('cached');
  const started = Date.now();
  const value = await cachedFetch({
    online: true,
    read: s.read,
    write: s.write,
    fetch: never,
    slowMs: 30,
  });
  assert.equal(value, 'cached');
  assert.ok(Date.now() - started < 1000);
});

test('offline reads the cache without fetching', async () => {
  const s = store('cached');
  let fetched = false;
  const value = await cachedFetch({
    online: false,
    read: s.read,
    write: s.write,
    fetch: async () => {
      fetched = true;
      return 'fresh';
    },
    slowMs: 30,
  });
  assert.equal(value, 'cached');
  assert.equal(fetched, false);
});

test('online and fast: the fresh copy, which replaces the cache', async () => {
  const s = store('cached');
  const value = await cachedFetch({
    online: true,
    read: s.read,
    write: s.write,
    fetch: async () => 'fresh',
    slowMs: 1000,
  });
  assert.equal(value, 'fresh');
  assert.equal(s.current(), 'fresh');
});

test('nothing cached: a network error comes through, and offline says so', async () => {
  const s = store();
  const failing = async (): Promise<string> => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    cachedFetch({ online: true, read: s.read, write: s.write, fetch: failing, slowMs: 30 })
  );
  await assert.rejects(
    cachedFetch({ online: false, read: s.read, write: s.write, fetch: failing, slowMs: 30 }),
    /saved on this phone/
  );
});

test('withTimeout rejects with a network-shaped error', async () => {
  const err = await withTimeout(never(), 20).catch((e: unknown) => e);
  assert.equal(isNetworkError(err), true);
  assert.equal(await withTimeout(Promise.resolve(5), 1000), 5);
});
