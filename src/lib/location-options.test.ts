import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterOptions,
  locationOptions,
  NO_PROVINCE,
  picksFromBarangay,
  type LocationPicks,
} from './location-options';
import type { PsgcTree } from './psgc';

const city = (code: string, barangays: string[] = []) => ({
  code,
  name: `City ${code}`,
  barangays: barangays.map((b) => ({ code: b, name: `Barangay ${b}` })),
});

const TREE: PsgcTree = [
  { code: 'ncr', name: 'NCR', provinces: [], cities: [city('mla', ['b1']), city('qc', ['b2'])] },
  {
    code: 'mixed',
    name: 'Region IX',
    provinces: [{ code: 'zds', name: 'Zamboanga del Sur', cities: [city('pag', ['b3'])] }],
    cities: [city('isa', ['b4'])],
  },
];

const picks = (patch: Partial<LocationPicks> = {}): LocationPicks => ({
  region_code: '',
  province_code: '',
  city_code: '',
  ...patch,
});

test('no saved list means off-campus is unavailable', () => {
  const options = locationOptions(null, picks());
  assert.equal(options.available, false);
  assert.deepEqual(options.regions, []);
});

test('the regions are listed before any choice', () => {
  const options = locationOptions(TREE, picks());
  assert.equal(options.available, true);
  assert.deepEqual(
    options.regions.map((r) => r.name),
    ['NCR', 'Region IX']
  );
  assert.equal(options.showProvince, false);
  assert.deepEqual(options.cities, []);
});

test('a region with no provinces hides Province and lists its cities', () => {
  const options = locationOptions(TREE, picks({ region_code: 'ncr' }));
  assert.equal(options.showProvince, false);
  assert.deepEqual(
    options.cities.map((c) => c.code),
    ['mla', 'qc']
  );
});

test('a region with both adds a no-province option, and waits for a choice', () => {
  const options = locationOptions(TREE, picks({ region_code: 'mixed' }));
  assert.equal(options.showProvince, true);
  assert.deepEqual(options.provinces.at(-1), {
    code: NO_PROVINCE,
    name: 'City not under a province',
  });
  assert.deepEqual(options.cities, []);
});

test('a region with only provinces has no extra option', () => {
  const tree: PsgcTree = [{ ...TREE[1], cities: [] }];
  const options = locationOptions(tree, picks({ region_code: 'mixed' }));
  assert.deepEqual(
    options.provinces.map((p) => p.code),
    ['zds']
  );
});

test('choosing no province lists the independent cities', () => {
  const options = locationOptions(
    TREE,
    picks({ region_code: 'mixed', province_code: NO_PROVINCE })
  );
  assert.deepEqual(
    options.cities.map((c) => c.code),
    ['isa']
  );
});

test('choosing a province lists its cities', () => {
  const options = locationOptions(TREE, picks({ region_code: 'mixed', province_code: 'zds' }));
  assert.deepEqual(
    options.cities.map((c) => c.code),
    ['pag']
  );
});

test('choosing a city lists its barangays', () => {
  const options = locationOptions(TREE, picks({ region_code: 'ncr', city_code: 'mla' }));
  assert.deepEqual(options.barangays, [{ code: 'b1', name: 'Barangay b1' }]);
});

test('a code the list no longer has gives empty choices, not an error', () => {
  const options = locationOptions(TREE, picks({ region_code: 'gone', city_code: 'gone' }));
  assert.deepEqual(options.cities, []);
  assert.deepEqual(options.barangays, []);
});

test('picksFromBarangay finds a city with no province in a region without provinces', () => {
  assert.deepEqual(picksFromBarangay(TREE, 'b1'), {
    region_code: 'ncr',
    province_code: '',
    city_code: 'mla',
  });
});

test('picksFromBarangay finds a city beside provinces', () => {
  assert.deepEqual(picksFromBarangay(TREE, 'b4'), {
    region_code: 'mixed',
    province_code: NO_PROVINCE,
    city_code: 'isa',
  });
});

test('picksFromBarangay finds a city in a province', () => {
  assert.deepEqual(picksFromBarangay(TREE, 'b3'), {
    region_code: 'mixed',
    province_code: 'zds',
    city_code: 'pag',
  });
});

test('picksFromBarangay gives null with no list or an unknown code', () => {
  assert.equal(picksFromBarangay(null, 'b1'), null);
  assert.equal(picksFromBarangay(TREE, 'nope'), null);
});

const OPTIONS = [
  { value: '1', label: 'Barangay 670' },
  { value: '2', label: 'Las Piñas' },
  { value: '3', label: 'Quezon City' },
];

test('filterOptions matches any part of the label, ignoring case', () => {
  assert.deepEqual(
    filterOptions(OPTIONS, 'zon c').map((o) => o.value),
    ['3']
  );
});

test('filterOptions ignores accents', () => {
  assert.deepEqual(
    filterOptions(OPTIONS, 'pinas').map((o) => o.value),
    ['2']
  );
});

test('a blank search keeps every option', () => {
  assert.equal(filterOptions(OPTIONS, '  ').length, 3);
});
