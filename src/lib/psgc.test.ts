import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPsgcTree, indexBarangays, type PsgcSource } from './psgc';

const source = (patch: Partial<PsgcSource> = {}): PsgcSource => ({
  regions: [{ code: '0100000000', name: 'Ilocos Region' }],
  provinces: [{ code: '0102800000', name: 'Ilocos Norte', regionCode: '0100000000' }],
  cities: [
    {
      key: 'mun1',
      code: '0102801000',
      name: 'Adams',
      regionCode: '0100000000',
      provinceCode: '0102800000',
    },
  ],
  barangays: [{ code: '0102801001', name: 'Adams (Pob.)', cityKey: 'mun1' }],
  ...patch,
});

const manila = {
  key: 'mla',
  code: '1380600000',
  name: 'City of Manila',
  regionCode: '0100000000',
  provinceCode: null,
};

test('a municipality in a province holds its barangays', () => {
  const [region] = buildPsgcTree(source());
  assert.equal(region.provinces[0].name, 'Ilocos Norte');
  assert.equal(region.provinces[0].cities[0].name, 'Adams');
  assert.deepEqual(region.provinces[0].cities[0].barangays, [
    { code: '0102801001', name: 'Adams (Pob.)' },
  ]);
  assert.deepEqual(region.cities, []);
});

test('a city with no province sits directly under the region', () => {
  const [region] = buildPsgcTree(
    source({
      provinces: [],
      cities: [manila],
      barangays: [{ code: '1380601001', name: 'Barangay 1', cityKey: 'mla' }],
    })
  );
  assert.deepEqual(region.provinces, []);
  assert.equal(region.cities[0].name, 'City of Manila');
  assert.equal(region.cities[0].barangays[0].code, '1380601001');
});

test('codes keep their leading zero', () => {
  const [region] = buildPsgcTree(
    source({ barangays: [{ code: 102801001, name: 'Adams (Pob.)', cityKey: 'mun1' }] })
  );
  assert.equal(region.provinces[0].cities[0].barangays[0].code, '0102801001');
});

test('names lose surrounding spaces', () => {
  const [region] = buildPsgcTree(
    source({ barangays: [{ code: '0102801001', name: ' Adams (Pob.) ', cityKey: 'mun1' }] })
  );
  assert.equal(region.provinces[0].cities[0].barangays[0].name, 'Adams (Pob.)');
});

test('barangays are listed by name, with numbers in number order', () => {
  const [region] = buildPsgcTree(
    source({
      barangays: [
        { code: '0102801003', name: 'Barangay 10', cityKey: 'mun1' },
        { code: '0102801002', name: 'Barangay 2', cityKey: 'mun1' },
      ],
    })
  );
  assert.deepEqual(
    region.provinces[0].cities[0].barangays.map((b) => b.name),
    ['Barangay 2', 'Barangay 10']
  );
});

test('a barangay with no city throws, naming its code', () => {
  assert.throws(
    () =>
      buildPsgcTree(source({ barangays: [{ code: '0102899001', name: 'Lost', cityKey: 'nope' }] })),
    /0102899001/
  );
});

test('a city whose province is missing throws, naming its code', () => {
  assert.throws(() => buildPsgcTree(source({ provinces: [] })), /0102801000/);
});

test('indexBarangays gives the whole location', () => {
  const location = indexBarangays(buildPsgcTree(source())).get('0102801001');
  assert.deepEqual(location, {
    region: { code: '0100000000', name: 'Ilocos Region' },
    province: { code: '0102800000', name: 'Ilocos Norte' },
    city: { code: '0102801000', name: 'Adams' },
    barangay: { code: '0102801001', name: 'Adams (Pob.)' },
  });
});

test('indexBarangays gives province null when there is none', () => {
  const tree = buildPsgcTree(
    source({
      provinces: [],
      cities: [manila],
      barangays: [{ code: '1380601001', name: 'Barangay 1', cityKey: 'mla' }],
    })
  );
  assert.equal(indexBarangays(tree).get('1380601001')?.province, null);
});
