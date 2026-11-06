import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildingInCampus,
  campusBuildings,
  offCampusBuildings,
  offCampusPool,
  placeDetailRows,
  placeLine,
  toBuildingPlace,
} from './building-place';

const noLocation = {
  region_code: null,
  region_name: null,
  province_code: null,
  province_name: null,
  city_code: null,
  city_name: null,
  barangay_code: null,
  barangay_name: null,
};

const campusRow = {
  ...noLocation,
  campus: null,
  unit: {
    id: 'u1',
    name: 'College of Medicine',
    cluster: {
      id: 'cl1',
      name: 'Padre Faura',
      campus: { id: 'c1', name: 'UP Manila' },
    },
  },
};

const offCampusRow = {
  unit: null,
  campus: { id: 'c1', name: 'UP Manila' },
  region_code: '1300000000',
  region_name: 'NCR',
  province_code: null,
  province_name: null,
  city_code: '1380600000',
  city_name: 'City of Manila',
  barangay_code: '1380605670',
  barangay_name: 'Barangay 670',
};

test('campusBuildings only ever matches buildings with a unit', () => {
  assert.deepEqual(campusBuildings('c1'), {
    unit_id: { not: null },
    unit: { cluster: { campus_id: 'c1' } },
  });
  assert.deepEqual(campusBuildings(null), { unit_id: { not: null } });
});

test('offCampusBuildings matches no unit, and the owning campus', () => {
  assert.deepEqual(offCampusBuildings('c1'), { unit_id: null, campus_id: 'c1' });
  assert.deepEqual(offCampusBuildings(null), { unit_id: null });
});

test('buildingInCampus covers both categories', () => {
  assert.deepEqual(buildingInCampus('c1'), {
    OR: [{ unit: { cluster: { campus_id: 'c1' } } }, { campus_id: 'c1' }],
  });
  assert.deepEqual(buildingInCampus(null), {});
});

test('toBuildingPlace reads a campus row', () => {
  assert.deepEqual(toBuildingPlace(campusRow), {
    category: 'campus',
    campus: { id: 'c1', name: 'UP Manila' },
    cluster: { id: 'cl1', name: 'Padre Faura' },
    unit: { id: 'u1', name: 'College of Medicine' },
    location: null,
    label: 'College of Medicine',
  });
});

test('toBuildingPlace reads an off-campus row with no province', () => {
  const place = toBuildingPlace(offCampusRow);
  assert.equal(place.category, 'off_campus');
  assert.deepEqual(place.campus, { id: 'c1', name: 'UP Manila' });
  assert.equal(place.cluster, null);
  assert.equal(place.unit, null);
  assert.equal(place.location?.province, null);
  assert.deepEqual(place.location?.barangay, { code: '1380605670', name: 'Barangay 670' });
  assert.equal(place.label, 'Barangay 670, City of Manila');
});

test('toBuildingPlace keeps a province when there is one', () => {
  const place = toBuildingPlace({
    ...offCampusRow,
    province_code: '0102800000',
    province_name: 'Ilocos Norte',
  });
  assert.deepEqual(place.location?.province, { code: '0102800000', name: 'Ilocos Norte' });
});

test('toBuildingPlace refuses a row with no unit and no location', () => {
  assert.throws(() => toBuildingPlace({ ...noLocation, unit: null, campus: null }));
});

test('placeLine adds the cluster on campus and just the place off campus', () => {
  assert.equal(placeLine(toBuildingPlace(campusRow)), 'College of Medicine · Padre Faura');
  assert.equal(placeLine(toBuildingPlace(offCampusRow)), 'Barangay 670, City of Manila');
});

test('placeDetailRows shows unit and cluster on campus', () => {
  assert.deepEqual(
    placeDetailRows({ location: null, unit_name: 'College of Medicine', cluster_name: 'PF' }),
    [
      ['College or unit', 'College of Medicine'],
      ['Cluster', 'PF'],
    ]
  );
});

test('placeDetailRows shows the location off campus, without an empty province', () => {
  const { location } = toBuildingPlace(offCampusRow);
  assert.deepEqual(placeDetailRows({ location, unit_name: null, cluster_name: null }), [
    ['Region', 'NCR'],
    ['City or municipality', 'City of Manila'],
    ['Barangay', 'Barangay 670'],
  ]);
});

/* ─── Off-campus accounts (DRRM-026) ─── */

test('offCampusPool(null) means no campus, unlike offCampusBuildings(null)', () => {
  assert.deepEqual(offCampusPool(null), { unit_id: null, campus_id: null });
  assert.deepEqual(offCampusPool('c1'), { unit_id: null, campus_id: 'c1' });
  assert.deepEqual(offCampusBuildings(null), { unit_id: null });
});

test('toBuildingPlace reads an off-campus row with no campus', () => {
  const place = toBuildingPlace({ ...offCampusRow, campus: null });
  assert.equal(place.category, 'off_campus');
  assert.equal(place.campus, null);
  assert.equal(place.label, 'Barangay 670, City of Manila');
});

test('a campus row still needs its unit', () => {
  assert.throws(() => toBuildingPlace({ ...offCampusRow, campus: null, region_code: null }));
});
