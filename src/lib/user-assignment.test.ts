import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withoutAssignment } from './user-assignment';

// What an off-campus account is saved with (DRRM-026): no UP assignment, and nothing the users
// table doesn't have a column for.

const fromForm = {
  first_name: 'Jomar',
  email: 'user@test.com',
  campus_id: 'c1',
  cluster_id: 'k1',
  unit_id: 'u1',
  position_id: 'p1',
  custom_unit_name: 'Room 500s',
  custom_position_name: 'Safety Officer',
};

test('clears the UP assignment', () => {
  const data = withoutAssignment(fromForm);
  assert.equal(data.campus_id, null);
  assert.equal(data.cluster_id, null);
  assert.equal(data.unit_id, null);
  assert.equal(data.position_id, null);
});

test('drops the form-only names, which are not columns', () => {
  const data = withoutAssignment(fromForm);
  assert.equal('custom_unit_name' in data, false);
  assert.equal('custom_position_name' in data, false);
});

test('keeps everything else', () => {
  const data = withoutAssignment(fromForm);
  assert.equal(data.first_name, 'Jomar');
  assert.equal(data.email, 'user@test.com');
});
