import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AdminScope } from './admin-scope';
import { canAssignUserType, canManageUser } from './user-access';

// Who may read and change which accounts on the Users page. Before, the actions trusted the
// client; now the server decides from the verified caller (security review of DRRM-025/026).

type Scope = AdminScope & { ok: true };
const superAdmin: Scope = { ok: true, role: 'super_admin', campusId: null };
const admin: Scope = { ok: true, role: 'administrator', campusId: 'c1' };

const ert = (campus_id: string | null, is_off_campus = false) => ({
  campus_id,
  user_type: { name: 'ERT Member' },
  is_off_campus,
});

test('a super admin may manage anyone', () => {
  assert.equal(canManageUser(superAdmin, ert('c2')), true);
  assert.equal(canManageUser(superAdmin, ert(null, true)), true);
  assert.equal(
    canManageUser(superAdmin, { campus_id: 'c1', user_type: { name: 'Super Admin' } }),
    true
  );
});

test('an administrator manages accounts on their own campus only', () => {
  assert.equal(canManageUser(admin, ert('c1')), true);
  assert.equal(canManageUser(admin, ert('c2')), false);
  assert.equal(canManageUser(admin, ert(null)), false);
});

test('an administrator never manages a super admin or an off-campus account', () => {
  assert.equal(
    canManageUser(admin, { campus_id: 'c1', user_type: { name: 'Super Admin' } }),
    false
  );
  assert.equal(canManageUser(admin, ert(null, true)), false);
});

test('only a super admin may give the Super Admin type', () => {
  assert.equal(canAssignUserType(superAdmin, 'Super Admin'), true);
  assert.equal(canAssignUserType(admin, 'Super Admin'), false);
  assert.equal(canAssignUserType(admin, 'Administrator'), true);
  assert.equal(canAssignUserType(admin, 'ERT Member'), true);
});

test('an unknown user type is never assignable', () => {
  assert.equal(canAssignUserType(superAdmin, undefined), false);
  assert.equal(canAssignUserType(admin, 'Bystander'), false);
});
