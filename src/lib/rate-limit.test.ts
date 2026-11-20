import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp, nextWindow } from './rate-limit';

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
