import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessmentDetailsSchema,
  assessmentPayloadSchema,
  itemSchema,
  offCampusProfileSchema,
  userCreateSchema,
  userEditSchema,
} from './schemas';

const U = '7a0c3b9e-3f5b-4d2a-9c1e-2b8f6d4a1e00';
const valid = {
  client_ref: U,
  evaluator_id: U,
  template_version_id: U,
  building: { new: { unit_id: U, name: ' Annex ' } },
  event_id: null,
  incident_commander: '',
  floor_count: 2,
  area_type_ids: [U],
  started_at: '2026-10-20T01:00:00.000Z',
  ended_at: '2026-10-20T02:00:00.000Z',
  answers: [{ item_id: U, answer: 'yes', remarks: null }],
  comments: [],
};

test('assessment payload', () => {
  const parsed = assessmentPayloadSchema.parse(valid);
  assert.deepEqual(parsed.building, { new: { unit_id: U, name: 'Annex' } });
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, floor_count: 0 }).success, false);
  assert.equal(
    assessmentPayloadSchema.safeParse({
      ...valid,
      answers: [{ item_id: U, answer: 'maybe', remarks: null }],
    }).success,
    false
  );
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, building: { id: U } }).success, true);
});

const offCampusBuilding = {
  new_off_campus: {
    barangay_code: '1380601001',
    name: ' Annex ',
    latitude: null,
    longitude: null,
    location_name: null,
  },
};

test('a queued payload from before off-campus still parses', () => {
  const parsed = assessmentPayloadSchema.parse(valid);
  assert.ok('new' in parsed.building);
});

test('an off-campus payload trims the name and keeps the code', () => {
  const parsed = assessmentPayloadSchema.parse({ ...valid, building: offCampusBuilding });
  assert.ok('new_off_campus' in parsed.building);
  assert.equal(parsed.building.new_off_campus.name, 'Annex');
  assert.equal(parsed.building.new_off_campus.barangay_code, '1380601001');
});

test('an off-campus payload needs a 10-digit barangay code', () => {
  const building = {
    new_off_campus: { ...offCampusBuilding.new_off_campus, barangay_code: '138060' },
  };
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, building }).success, false);
});

test('a pin outside the map is refused', () => {
  const building = {
    new_off_campus: { ...offCampusBuilding.new_off_campus, latitude: 95, longitude: 120 },
  };
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, building }).success, false);
});

const details = {
  location_kind: 'campus' as const,
  cluster_id: U,
  unit_id: U,
  region_code: '',
  province_code: '',
  city_code: '',
  barangay_code: '',
  building_id: U,
  new_building_name: '',
  incident_commander: '',
  event_id: '',
};

const issuePaths = (data: unknown) => {
  const result = assessmentDetailsSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
};

test('details need a location choice', () => {
  assert.deepEqual(issuePaths({ ...details, location_kind: null }), ['location_kind']);
});

test('on-campus details still need a cluster and unit', () => {
  assert.deepEqual(issuePaths(details), []);
  assert.deepEqual(issuePaths({ ...details, cluster_id: '', unit_id: '' }), [
    'cluster_id',
    'unit_id',
  ]);
});

test('off-campus details need a location, not a cluster or unit', () => {
  const off = { ...details, location_kind: 'off_campus' as const, cluster_id: '', unit_id: '' };
  assert.deepEqual(issuePaths(off), ['region_code', 'city_code', 'barangay_code']);
  assert.deepEqual(
    issuePaths({ ...off, region_code: 'r', city_code: 'c', barangay_code: 'b' }),
    []
  );
});

test('details still need a building or a new name', () => {
  assert.deepEqual(issuePaths({ ...details, building_id: '' }), ['building_id']);
  assert.deepEqual(issuePaths({ ...details, building_id: '', new_building_name: 'Annex' }), []);
});

test('checklist item schema enforces pillar on scored items and scored on sub-items', () => {
  const base = {
    code: '1',
    prompt_en: 'Fire alarms work',
    prompt_fil: 'Gumagana ang alarma',
    note_en: '',
    note_fil: '',
    reference: '',
    parent_id: '',
    is_scored: true,
    pillar_code: 'preparedness',
    safe_answer: 'yes',
    area_type_id: '',
    min_floors: '',
    flag_label: '',
  };
  assert.equal(itemSchema.safeParse(base).success, true);
  assert.equal(itemSchema.safeParse({ ...base, pillar_code: '' }).success, false);
  assert.equal(itemSchema.safeParse({ ...base, is_scored: false, pillar_code: '' }).success, true);
  assert.equal(
    itemSchema.safeParse({ ...base, parent_id: U, is_scored: false, pillar_code: '' }).success,
    false
  );
});

/* ─── Off-campus accounts (DRRM-026) ─── */

const newUser = {
  email: 'jmlazaro@gmail.com',
  password: 'Test1234!',
  confirmPassword: 'Test1234!',
  first_name: 'Jomar',
  last_name: 'Lazaro',
  username: 'jmlazaro',
  user_type_id: U,
  is_active: true,
  campus_id: '',
};

const userIssues = (
  data: unknown,
  schema: typeof userCreateSchema | typeof userEditSchema = userCreateSchema
) => {
  const result = schema.safeParse(data);
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
};

test('an off-campus account needs no campus', () => {
  assert.deepEqual(userIssues({ ...newUser, is_off_campus: true }), []);
});

test('any other account still needs a campus', () => {
  assert.deepEqual(userIssues(newUser), ['campus_id']);
  assert.deepEqual(userIssues({ ...newUser, campus_id: U }), []);
});

test('editing follows the same campus rule', () => {
  const { password: _p, confirmPassword: _c, ...edit } = newUser;
  assert.deepEqual(userIssues(edit, userEditSchema), ['campus_id']);
  assert.deepEqual(userIssues({ ...edit, is_off_campus: true }, userEditSchema), []);
});

const offCampusProfile = {
  first_name: ' Jomar ',
  last_name: 'Lazaro',
  address: '123 Rizal St, Iloilo City',
  organization: 'Iloilo DRRM Office',
  organization_address: 'City Hall, Iloilo City',
  position_title: 'Safety Officer',
  consent: true,
};

test('the off-campus profile trims its fields', () => {
  assert.equal(offCampusProfileSchema.parse(offCampusProfile).first_name, 'Jomar');
});

test('the off-campus profile needs every field and the consent', () => {
  const issues = (data: unknown) => {
    const result = offCampusProfileSchema.safeParse(data);
    return result.success ? [] : result.error.issues.map((i) => i.path[0]);
  };
  assert.deepEqual(issues({ ...offCampusProfile, organization: '  ' }), ['organization']);
  assert.deepEqual(issues({ ...offCampusProfile, consent: false }), ['consent']);
  assert.deepEqual(issues({ ...offCampusProfile, address: 'x'.repeat(401) }), ['address']);
});
