import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canEditPopulationField } from './population-field-access';

const admin = { ok: true as const, role: 'administrator' as const, campusId: 'campus-a' };
const superAdmin = { ok: true as const, role: 'super_admin' as const, campusId: null };
const unused = { linkedElsewhere: 0, reportedElsewhere: 0 };

test('an Administrator may edit a field no other campus links to or has reported', () => {
  assert.equal(canEditPopulationField(admin, unused), true);
});

test('an Administrator may not edit a field another campus still has on its list', () => {
  assert.equal(canEditPopulationField(admin, { ...unused, linkedElsewhere: 1 }), false);
});

test("an Administrator may not edit a field another campus's reports carry a headcount for", () => {
  // Campus B dropped the field from its list, but its past reports still use it.
  assert.equal(canEditPopulationField(admin, { ...unused, reportedElsewhere: 3 }), false);
});

test('a Super Admin may edit any field, used or not', () => {
  assert.equal(canEditPopulationField(superAdmin, unused), true);
  assert.equal(
    canEditPopulationField(superAdmin, { linkedElsewhere: 2, reportedElsewhere: 9 }),
    true
  );
});
