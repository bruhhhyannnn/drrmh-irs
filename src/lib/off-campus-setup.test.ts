import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composeAddress,
  offCampusSetupSchema,
  SETUP_STEP_FIELDS,
  type OffCampusSetupValues,
} from './off-campus-setup';
import type { PsgcTree } from './psgc';

// The off-campus account's three-step setup (DRRM-026): which fields each step checks, and the
// readable address line saved from the picked places.

const TREE: PsgcTree = [
  {
    code: 'r6',
    name: 'Western Visayas',
    provinces: [
      {
        code: 'p-ilo',
        name: 'Iloilo',
        cities: [
          { code: 'c-ilo', name: 'Iloilo City', barangays: [{ code: 'b1', name: 'Tabuc Suba' }] },
        ],
      },
    ],
    cities: [],
  },
  {
    code: 'ncr',
    name: 'NCR',
    provinces: [],
    cities: [
      { code: 'mla', name: 'City of Manila', barangays: [{ code: 'b2', name: 'Barangay 670' }] },
    ],
  },
];

test('the address line runs from street to region', () => {
  assert.equal(
    composeAddress(TREE, 'b1', ' 123 Rizal St. '),
    '123 Rizal St., Tabuc Suba, Iloilo City, Iloilo, Western Visayas'
  );
});

test('the address line skips an empty street and a missing province', () => {
  assert.equal(composeAddress(TREE, 'b2', '  '), 'Barangay 670, City of Manila, NCR');
});

test('an unknown barangay gives no address line', () => {
  assert.equal(composeAddress(TREE, 'nope', ''), null);
  assert.equal(composeAddress(null, 'b1', ''), null);
});

const complete: OffCampusSetupValues = {
  first_name: 'Jomar',
  middle_name: '',
  last_name: 'Lazaro',
  suffix: '',
  home_region_code: 'r6',
  home_province_code: 'p-ilo',
  home_city_code: 'c-ilo',
  home_barangay_code: 'b1',
  home_street: '',
  organization: 'Iloilo City DRRM Office',
  position_title: 'Safety Officer',
  work_same_as_home: false,
  work_region_code: 'ncr',
  work_province_code: '',
  work_city_code: 'mla',
  work_barangay_code: 'b2',
  work_street: '',
  consent: true,
};

const issues = (data: unknown) => {
  const result = offCampusSetupSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
};

test('a complete setup passes', () => {
  assert.deepEqual(issues(complete), []);
});

test('the home address needs a barangay', () => {
  assert.deepEqual(issues({ ...complete, home_barangay_code: '' }), ['home_barangay_code']);
});

test('the work address is needed unless it is the same as home', () => {
  const noWork = { ...complete, work_region_code: '', work_city_code: '', work_barangay_code: '' };
  assert.deepEqual(issues(noWork), ['work_region_code', 'work_city_code', 'work_barangay_code']);
  assert.deepEqual(issues({ ...noWork, work_same_as_home: true }), []);
});

test('the consent is needed', () => {
  assert.deepEqual(issues({ ...complete, consent: false }), ['consent']);
});

test('each step checks only its own fields, and every field belongs to a step', () => {
  assert.deepEqual(SETUP_STEP_FIELDS.about, ['first_name', 'middle_name', 'last_name', 'suffix']);
  assert.ok(SETUP_STEP_FIELDS.home.includes('home_barangay_code'));
  assert.ok(SETUP_STEP_FIELDS.work.includes('consent'));
  const all = Object.values(SETUP_STEP_FIELDS).flat().sort();
  assert.deepEqual(all, Object.keys(complete).sort());
});
