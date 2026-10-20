import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessmentPayloadSchema } from './schemas';

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
