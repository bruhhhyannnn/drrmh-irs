import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canWriteSetting, isGlobalSettingsTable, isSettingsTable } from './settings-access';

// Who may change which Settings list (#103): Super Admins anything; Administrators their own
// campus's clusters, units and buildings, and the shared lists; campuses are Super Admin only.

const admin = { ok: true as const, role: 'administrator' as const, campusId: 'campus-a' };
const superAdmin = { ok: true as const, role: 'super_admin' as const, campusId: null };

test('an Administrator writes clusters, units and buildings of their own campus', () => {
  for (const table of ['clusters', 'units', 'buildings'] as const) {
    assert.equal(canWriteSetting(admin, table, ['campus-a']), true, table);
    assert.equal(canWriteSetting(admin, table, ['campus-a', 'campus-a']), true, table);
  }
});

test("an Administrator can't touch another campus's row, or move one there", () => {
  assert.equal(canWriteSetting(admin, 'clusters', ['campus-b']), false);
  // Existing row on campus A, new parent on campus B (or the other way round).
  assert.equal(canWriteSetting(admin, 'units', ['campus-a', 'campus-b']), false);
  assert.equal(canWriteSetting(admin, 'buildings', ['campus-b', 'campus-a']), false);
  // A parent that doesn't exist, or a building with no campus (off campus).
  assert.equal(canWriteSetting(admin, 'units', [undefined]), false);
  assert.equal(canWriteSetting(admin, 'buildings', [null]), false);
  assert.equal(canWriteSetting(admin, 'clusters', []), false);
});

test('an Administrator may change the shared lists: positions and the two condition lists', () => {
  // No campus to check: every campus picks from the same list (owner decision, #103).
  for (const table of ['positions', 'casualty_conditions', 'damage_conditions'] as const) {
    assert.equal(isGlobalSettingsTable(table), false, table);
    assert.equal(canWriteSetting(admin, table, []), true, table);
  }
});

test('an Administrator still cannot change the campuses (Super Admin only)', () => {
  assert.equal(isGlobalSettingsTable('campus'), true);
  assert.equal(canWriteSetting(admin, 'campus', []), false);
  assert.equal(canWriteSetting(admin, 'campus', ['campus-a']), false);
});

test('a Super Admin may write any list', () => {
  assert.equal(canWriteSetting(superAdmin, 'positions', []), true);
  assert.equal(canWriteSetting(superAdmin, 'campus', []), true);
  assert.equal(canWriteSetting(superAdmin, 'clusters', ['campus-b']), true);
});

test('only known tables are accepted', () => {
  assert.equal(isSettingsTable('units'), true);
  assert.equal(isSettingsTable('users'), false);
  assert.equal(isSettingsTable({ toString: () => 'units' }), false);
});
