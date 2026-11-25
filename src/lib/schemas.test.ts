import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessmentDetailsSchema,
  assessmentPayloadSchema,
  buildingSchema,
  bystanderReportSchema,
  completeProfileSchema,
  itemSchema,
  offCampusProfileSchema,
  reportCreateSchema,
  userCreateInputSchema,
  userCreateSchema,
  userEditSchema,
  userUpdateInputSchema,
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

test('the consent keeps its own message', () => {
  const result = offCampusProfileSchema.safeParse({ ...offCampusProfile, consent: false });
  assert.equal(result.error?.issues[0]?.message, 'Agree to the data privacy notice to continue.');
});

/* ─── Server-side allowlists (#101) ─── */

test('profile setup accepts only the campus, cluster, unit and position', () => {
  const setup = { campus_id: U, cluster_id: U, position_id: U };
  assert.equal(completeProfileSchema.safeParse(setup).success, true);
  for (const extra of [
    { user_type_id: U },
    { auth_id: U },
    { is_active: true },
    { is_off_campus: false },
    { is_profile_complete: true },
    { first_name: 'Juan' },
  ]) {
    const result = completeProfileSchema.safeParse({ ...setup, ...extra });
    assert.equal(result.success, false, JSON.stringify(extra));
  }
});

test('profile setup refuses ids that are not uuids and over-long typed names', () => {
  assert.equal(completeProfileSchema.safeParse({ campus_id: { not: U } }).success, false);
  assert.equal(
    completeProfileSchema.safeParse({ campus_id: U, custom_unit_name: 'x'.repeat(121) }).success,
    false
  );
});

const userWrite = {
  first_name: 'Jomar',
  last_name: 'Lazaro',
  email: 'jmlazaro@up.edu.ph',
  username: 'jmlazaro',
  user_type_id: U,
  campus_id: U,
  cluster_id: null,
  unit_id: null,
  position_id: null,
  custom_unit_name: null,
  custom_position_name: null,
  is_active: true,
  is_off_campus: false,
};

test('Add user and Edit user accept what the Users drawer sends', () => {
  assert.equal(
    userCreateInputSchema.safeParse({ ...userWrite, password: 'Test1234!' }).success,
    true
  );
  // Edit user sends everything but the email (the drawer shows it read-only).
  const { email: _email, ...editWrite } = userWrite;
  assert.equal(userUpdateInputSchema.safeParse(editWrite).success, true);
  assert.equal(userUpdateInputSchema.safeParse({ first_name: 'Jo' }).success, true);
});

test('Edit user refuses an email, which only Add user sets (#101)', () => {
  assert.equal(userUpdateInputSchema.safeParse({ email: 'other@up.edu.ph' }).success, false);
  assert.equal(
    userUpdateInputSchema.safeParse({ ...userWrite, email: 'other@up.edu.ph' }).success,
    false
  );
  assert.equal(
    userCreateInputSchema.safeParse({ ...userWrite, password: 'Test1234!', email: 'a@b' }).success,
    false
  );
});

test('Add user and Edit user refuse columns and relations the drawer never sends', () => {
  for (const extra of [
    { auth_id: U },
    { is_profile_complete: true },
    { reports: { connect: [{ id: U }] } },
    { user_type: { connect: { id: U } } },
  ]) {
    assert.equal(userUpdateInputSchema.safeParse({ ...userWrite, ...extra }).success, false);
    assert.equal(
      userCreateInputSchema.safeParse({ ...userWrite, password: 'Test1234!', ...extra }).success,
      false
    );
  }
  assert.equal(userUpdateInputSchema.safeParse({ password: 'Test1234!' }).success, false);
});

/* ─── The report payload `createReport` writes (#101) ─── */

const reportPayload = {
  event_id: U,
  cluster_id: U,
  unit_id: null,
  latitude: 14.6,
  longitude: 121,
  population_counts: [],
  damage_condition_id: null,
  report_missing_persons: [],
  report_casualties: [],
};
const casualty = {
  condition_id: U,
  name: 'Ana',
  age: 34,
  sex: 'female',
  diagnosis: null,
};

test('a report payload keeps only the report’s own fields', () => {
  const parsed = reportCreateSchema.parse({ ...reportPayload, is_verified: true, reviewed: 1 });
  assert.equal('is_verified' in parsed, false);
  assert.equal('reviewed' in parsed, false);
  assert.equal(reportCreateSchema.parse(reportPayload).cluster_id, U);
});

test('nested casualties and missing persons keep only their own fields', () => {
  const parsed = reportCreateSchema.parse({
    ...reportPayload,
    report_casualties: [{ ...casualty, id: U, bystander_report_id: U, report_id: U }],
    report_missing_persons: [{ name: 'Ben', age: 9, sex: 'male', id: U, report_id: U }],
  });
  assert.deepEqual(Object.keys(parsed.report_casualties[0]).sort(), [
    'age',
    'condition_id',
    'diagnosis',
    'name',
    'sex',
  ]);
  assert.deepEqual(Object.keys(parsed.report_missing_persons[0]).sort(), ['age', 'name', 'sex']);
});

test('a report payload refuses a list that is not an array or runs past the cap', () => {
  // The length bomb: an array-like object would make groupReportPhotos allocate billions of rows.
  const bomb = { length: 4294967295 };
  assert.equal(
    reportCreateSchema.safeParse({ ...reportPayload, report_casualties: bomb }).success,
    false
  );
  const tooMany = Array.from({ length: 101 }, () => casualty);
  assert.equal(
    reportCreateSchema.safeParse({ ...reportPayload, report_casualties: tooMany }).success,
    false
  );
  const atCap = Array.from({ length: 100 }, () => casualty);
  assert.equal(
    reportCreateSchema.safeParse({ ...reportPayload, report_casualties: atCap }).success,
    true
  );
});

test('a typed unit name is trimmed and capped at 120 characters', () => {
  const typed = reportCreateSchema.parse({ ...reportPayload, unit_name: '  Dispatch  ' });
  assert.equal(typed.unit_name, 'Dispatch');
  assert.equal(
    reportCreateSchema.safeParse({ ...reportPayload, unit_name: 'x'.repeat(121) }).success,
    false
  );
});

test('a report payload refuses an event or cluster that is not a uuid', () => {
  for (const field of ['event_id', 'cluster_id'] as const) {
    assert.equal(
      reportCreateSchema.safeParse({ ...reportPayload, [field]: 'not-a-uuid' }).success,
      false,
      field
    );
  }
});

/* ─── Zod 4 (DRRM-051) ─── */

const bystanderPayload = {
  incident_type_id: U,
  cluster_id: U,
  latitude: 14.6,
  longitude: 121,
};

test('an oversized list is refused at its cap, not checked entry by entry', () => {
  // GHSA-mrhx-c7xc-m3w5: zod 3 checked every entry of a list past its cap first, so a few MB of
  // `{}` made millions of issues and hundreds of MB of memory on the public bystander form.
  const flood = Array.from({ length: 200_000 }, () => ({}));
  const bystander = bystanderReportSchema.safeParse({
    ...bystanderPayload,
    report_casualties: flood,
  });
  assert.equal(bystander.success, false);
  assert.ok(bystander.error.issues.length < 5, `${bystander.error.issues.length} issues`);
  const report = reportCreateSchema.safeParse({ ...reportPayload, report_casualties: flood });
  assert.equal(report.success, false);
  assert.ok(report.error.issues.length < 5, `${report.error.issues.length} issues`);
});

test('ids keep the loose uuid check zod 3 had', () => {
  // Zod 4's uuid() also checks the version and variant digits; guid() is zod 3's pattern.
  const loose = '11111111-1111-1111-1111-111111111111';
  assert.equal(reportCreateSchema.safeParse({ ...reportPayload, event_id: loose }).success, true);
  assert.equal(
    bystanderReportSchema.safeParse({ ...bystanderPayload, cluster_id: loose }).success,
    true
  );
});

test('a bystander report without a location keeps its message', () => {
  const { latitude: _lat, ...withoutLocation } = bystanderPayload;
  const result = bystanderReportSchema.safeParse(withoutLocation);
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues[0]?.path, ['latitude']);
  assert.equal(result.error.issues[0]?.message, 'Please capture your location');
  // A coordinate that is there but not a number keeps zod's own message.
  const wrong = bystanderReportSchema.safeParse({ ...bystanderPayload, latitude: 'north' });
  assert.notEqual(wrong.error?.issues[0]?.message, 'Please capture your location');
});

test('a floor count that is not a number keeps its message', () => {
  const result = buildingSchema.safeParse({ name: 'Annex', unit_id: U, floor_count: 'two' });
  assert.equal(result.error?.issues[0]?.message, 'Enter the number of floors.');
});
