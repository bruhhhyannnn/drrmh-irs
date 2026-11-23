import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  campusPopulationLinkUpdateSchema,
  eventWriteSchema,
  populationCategoryCreateSchema,
  populationCategoryUpdateSchema,
  settingsWriteSchemas,
} from './schemas';

// Regression tests for #102 and #103: every write schema is a strict allowlist, so a nested
// Prisma write (`{ users: { updateMany: … } }`) or an id the server sets itself is refused before
// it reaches Prisma. The schemas are the ones the server actions parse with.

const U = '7a0c3b9e-3f5b-4d2a-9c1e-2b8f6d4a1e00';

const nestedWrite = { users: { updateMany: { where: {}, data: { user_type_id: U } } } };
const relationKeys = [
  nestedWrite,
  { reports: { deleteMany: {} } },
  { reports: { connect: [{ id: U }] } },
  { campus: { connect: { id: U } } },
  { user_id: U },
  { completed_by: U },
];

test('the event write schema refuses relation keys and the fields the server sets', () => {
  const valid = {
    name: 'Drill',
    description: null,
    quarter: 'Q4',
    started_at: null,
    ended_at: null,
    status_id: U,
  };
  assert.equal(eventWriteSchema.safeParse(valid).success, true);
  for (const extra of relationKeys) {
    assert.equal(eventWriteSchema.safeParse({ ...valid, ...extra }).success, false);
  }
  assert.equal(eventWriteSchema.safeParse({ ...valid, campus_id: U }).success, false);
});

test('every Settings write schema refuses relation keys', () => {
  for (const [table, schema] of Object.entries(settingsWriteSchemas)) {
    for (const extra of relationKeys) {
      const result = schema.safeParse({ name: 'x', ...extra });
      assert.equal(result.success, false, `${table} accepted ${JSON.stringify(extra)}`);
    }
  }
});

test('an Administrator payload cannot carry user_type_id through the settings schemas', () => {
  for (const [table, schema] of Object.entries(settingsWriteSchemas)) {
    const result = schema.safeParse({ name: 'x', user_type_id: U });
    assert.equal(result.success, false, `${table} accepted user_type_id`);
  }
});

test('a Settings write keeps its own columns', () => {
  const position = settingsWriteSchemas.positions.safeParse({ name: 'Nurse', is_active: true });
  assert.equal(position.success, true);
  const unit = settingsWriteSchemas.units.safeParse({ name: 'Ops', cluster_id: U });
  assert.equal(unit.success, true);
});

test('a new headcount field refuses relation keys and keeps its own columns', () => {
  const valid = { code: 'injured', name: 'Injured', is_active: true };
  assert.equal(populationCategoryCreateSchema.safeParse(valid).success, true);
  for (const extra of relationKeys) {
    assert.equal(populationCategoryCreateSchema.safeParse({ ...valid, ...extra }).success, false);
  }
});

test('a headcount field edit refuses relation keys and its code', () => {
  assert.equal(populationCategoryUpdateSchema.safeParse({ name: 'Injured' }).success, true);
  for (const extra of relationKeys) {
    assert.equal(populationCategoryUpdateSchema.safeParse({ name: 'x', ...extra }).success, false);
  }
  // The code is fixed once made.
  assert.equal(populationCategoryUpdateSchema.safeParse({ code: 'other' }).success, false);
});

test('a headcount field name loses control characters on create and edit', () => {
  const created = populationCategoryCreateSchema.parse({
    code: 'injured',
    name: 'In\u0007jured',
  });
  assert.equal(created.name, 'Injured');
  const edited = populationCategoryUpdateSchema.parse({ name: 'Dead\u0000' });
  assert.equal(edited.name, 'Dead');
});

test('a campus field link refuses relation keys and the ids it is found by', () => {
  assert.equal(campusPopulationLinkUpdateSchema.safeParse({ is_active: false }).success, true);
  for (const extra of [
    { campus: { update: { is_active: false } } },
    { category: { connect: { id: U } } },
    { campus_id: U },
    { category_id: U },
    { users: { deleteMany: {} } },
  ]) {
    assert.equal(
      campusPopulationLinkUpdateSchema.safeParse({ is_active: false, ...extra }).success,
      false
    );
  }
});
