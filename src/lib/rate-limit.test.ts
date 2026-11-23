import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp, nextWindow, withinRateLimit } from './rate-limit';

// The per-client limit on the public bystander form (#104).

const bag = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

test("the host's own IP header wins over what a client could send", () => {
  assert.equal(
    clientIp(bag({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4' })),
    '203.0.113.9'
  );
  assert.equal(clientIp(bag({ 'x-vercel-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7');
  assert.equal(clientIp(bag({ 'x-forwarded-for': ' 198.51.100.4 , 10.0.0.1' })), '198.51.100.4');
  assert.equal(clientIp(bag({})), null);
});

test('hits count within a window and start over after it', () => {
  const w = 10 * 60_000;
  let count = nextWindow(undefined, 0, w);
  assert.deepEqual(count, { start: 0, hits: 1 });
  count = nextWindow(count, 1_000, w);
  count = nextWindow(count, w - 1, w);
  assert.deepEqual(count, { start: 0, hits: 3 });
  assert.deepEqual(nextWindow(count, w, w), { start: w, hits: 1 });
});

// The shared counter (COUNT_HIT_SQL) runs in Postgres, which these tests can't reach, so they
// stand a table in with the same rules as the statement's CASE: a key's hits go up within its
// window and start over at 1 once `windowMs` has passed since the window began. The statement
// itself was checked by reading it against nextWindow; see prisma/manual/DRRM-049-rate-limits.sql.

/** An in-memory stand-in for public.rate_limits, driven by a clock the test moves. */
function fakeTable(clock: { now: number }) {
  const rows = new Map<string, { start: number; hits: number }>();
  return async (key: string, windowMs: number) => {
    const row = nextWindow(rows.get(key), clock.now, windowMs);
    rows.set(key, row);
    return row.hits;
  };
}

test('the shared count goes up within a window, starts over after it, and is per key', async () => {
  const clock = { now: 1_000 };
  const countHit = fakeTable(clock);
  const w = 60_000;
  assert.equal(await countHit('a', w), 1);
  clock.now += 30_000;
  assert.equal(await countHit('a', w), 2);
  assert.equal(await countHit('b', w), 1, 'another client starts its own count');
  clock.now += 30_000; // exactly one window after the first hit
  assert.equal(await countHit('a', w), 1, 'the window has passed, so the count starts over');
});

test('up to the limit is allowed, and the hit after it is refused', async () => {
  const clock = { now: 0 };
  const countHit = fakeTable(clock);
  const results: boolean[] = [];
  for (let i = 0; i < 4; i += 1) {
    results.push(await withinRateLimit('limit-case', 3, 60_000, countHit));
  }
  assert.deepEqual(results, [true, true, true, false]);
  clock.now += 60_000;
  assert.equal(await withinRateLimit('limit-case', 3, 60_000, countHit), true, 'a new window');
});

test('when the shared count throws, the hit is counted in this server copy instead', async () => {
  const broken = async () => {
    throw new Error('database unreachable');
  };
  const results: boolean[] = [];
  for (let i = 0; i < 3; i += 1) {
    results.push(await withinRateLimit('fallback-case', 2, 60_000, broken));
  }
  assert.deepEqual(results, [true, true, false]);
});
