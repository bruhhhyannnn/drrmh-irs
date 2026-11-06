import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBarangay, loadPsgcTree } from './psgc-data';

test('the list covers the whole country', async () => {
  const tree = await loadPsgcTree();
  assert.ok(tree.length >= 17, `${tree.length} regions`);
  const barangays = tree.flatMap((r) => [
    ...r.cities.flatMap((c) => c.barangays),
    ...r.provinces.flatMap((p) => p.cities.flatMap((c) => c.barangays)),
  ]);
  assert.ok(barangays.length > 41000, `${barangays.length} barangays`);
  assert.ok(barangays.every((b) => /^\d{10}$/.test(b.code)));
  assert.equal(new Set(barangays.map((b) => b.code)).size, barangays.length);
});

test('Metro Manila has no provinces, and its barangays reach their city', async () => {
  const tree = await loadPsgcTree();
  const ncr = tree.find((r) => r.code === '1300000000');
  assert.deepEqual(ncr?.provinces, []);
  const manila = await findBarangay('1380601001');
  assert.equal(manila?.city.name, 'City of Manila');
  assert.equal(manila?.province, null);
});

test('a place in a province finds its province', async () => {
  const adams = await findBarangay('0102801001');
  assert.equal(adams?.province?.name, 'Ilocos Norte');
  assert.equal(adams?.region.code, '0100000000');
});

test('an unknown code finds nothing', async () => {
  assert.equal(await findBarangay('0000000000'), null);
});
