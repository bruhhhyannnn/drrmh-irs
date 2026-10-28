import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canUseAssessment } from './access';

test('Phase 1: ERT members only', () => {
  assert.equal(
    canUseAssessment({ user_type: { name: 'ERT Member' }, position: { name: 'Marshall' } }),
    true
  );
  for (const name of ['Administrator', 'Super Admin', 'Bystander']) {
    assert.equal(canUseAssessment({ user_type: { name } }), false, name);
  }
  assert.equal(canUseAssessment(null), false);
});
