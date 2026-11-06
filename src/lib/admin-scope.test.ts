import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminScope, inScope } from './admin-scope';

test('an administrator always gets their own campus', () => {
  const admin = { user_type: { name: 'Administrator' }, campus_id: 'own' };
  assert.deepEqual(adminScope(admin), { ok: true, role: 'administrator', campusId: 'own' });
  assert.deepEqual(adminScope(admin, 'other'), {
    ok: true,
    role: 'administrator',
    campusId: 'own',
  });
  assert.deepEqual(adminScope(admin, null), { ok: true, role: 'administrator', campusId: 'own' });
  assert.deepEqual(adminScope({ ...admin, campus_id: null }), { ok: false });
});

test('a super admin gets the campus asked for, or all', () => {
  const sa = { user_type: { name: 'Super Admin' }, campus_id: 'own' };
  assert.deepEqual(adminScope(sa, 'other'), { ok: true, role: 'super_admin', campusId: 'other' });
  assert.deepEqual(adminScope(sa), { ok: true, role: 'super_admin', campusId: null });
  assert.deepEqual(adminScope(sa, ''), { ok: true, role: 'super_admin', campusId: null });
});

test('anyone else is refused', () => {
  for (const name of ['ERT Member', 'Bystander']) {
    assert.deepEqual(adminScope({ user_type: { name }, campus_id: 'own' }), { ok: false });
  }
  assert.deepEqual(adminScope({ user_type: null, campus_id: 'own' }), { ok: false });
});

test('inScope: all campuses or the same one', () => {
  assert.equal(inScope({ ok: true, role: 'super_admin', campusId: null }, 'x'), true);
  assert.equal(inScope({ ok: true, role: 'administrator', campusId: 'a' }, 'a'), true);
  assert.equal(inScope({ ok: true, role: 'administrator', campusId: 'a' }, 'b'), false);
});

test('inScope: a record with no campus is only in the all-campuses scope (DRRM-026)', () => {
  const all = { ok: true as const, role: 'super_admin' as const, campusId: null };
  const one = { ok: true as const, role: 'super_admin' as const, campusId: 'c1' };
  const admin = { ok: true as const, role: 'administrator' as const, campusId: 'c1' };
  assert.equal(inScope(all, null), true);
  assert.equal(inScope(one, null), false);
  assert.equal(inScope(admin, null), false);
});
