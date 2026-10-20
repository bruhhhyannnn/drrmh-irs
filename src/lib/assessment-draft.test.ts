import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import {
  applyBuildingProfile,
  clampFloors,
  draftSteps,
  newDraft,
  newUuid,
  sectionProgress,
  setAsideCount,
  toPayload,
  type AssessmentDraft,
} from './assessment-draft';
import { templateFromData } from './assessment-template';

// The draft kept on the phone while an assessment is filled in, and the payload made from it.

const T = templateFromData(MATATAG_2025_07_25);
const id = (label: string) => label.replace('.', '/');
const draft = (patch: Partial<AssessmentDraft> = {}): AssessmentDraft => ({
  ...newDraft({
    client_ref: newUuid(),
    evaluator_id: 'u1',
    campus_id: 'c1',
    template_version_id: T.version_id,
    cluster_id: 'k1',
    unit_id: 'unit1',
    now: new Date('2026-10-20T01:00:00Z'),
  }),
  ...patch,
});

test('floors clamp to a whole number from 1 to 200', () => {
  assert.deepEqual(
    [clampFloors(0), clampFloors(Number.NaN), clampFloors(2.6), clampFloors(500)],
    [1, 1, 3, 200]
  );
});

test('unticking an area sets its answers aside; ticking it again brings them back', () => {
  const d = draft({
    floor_count: 4,
    area_type_ids: ['laboratories'],
    answers: {
      [id('XIII.1')]: { answer: 'yes' },
      [id('V.5.5')]: { answer: 'no' },
      [id('II.1')]: { answer: 'yes' },
    },
  });
  assert.equal(setAsideCount(T, d, { floor_count: 4, area_type_ids: [] }), 2);
  const unticked = { ...d, area_type_ids: [] };
  assert.deepEqual(
    toPayload(T, unticked, new Date()).answers.map((a) => a.item_id),
    [id('II.1')]
  );
  assert.equal(Object.keys(unticked.answers).length, 3);
  assert.equal(sectionProgress(T, d)['XIII'].answered, 1);
});

test('floors 4 → 2 sets the sprinkler answers aside', () => {
  const d = draft({
    floor_count: 4,
    area_type_ids: ['corridors'],
    answers: { [id('V.6.1')]: { answer: 'yes' } },
  });
  assert.equal(setAsideCount(T, d, { floor_count: 2, area_type_ids: ['corridors'] }), 1);
});

test('toPayload: new building, no event, group remarks, comments, evaluator', () => {
  const d = draft({
    building_id: '',
    new_building_name: '  Annex  ',
    area_type_ids: ['bathrooms'],
    answers: { 'III/2': { remarks: 'Hinges loose' }, [id('XIII.1')]: { answer: 'no' } },
    comments: { II: '  ', III: 'Check doors', XIII: 'x' },
  });
  const p = toPayload(T, d, new Date('2026-10-20T02:00:00Z'));
  assert.deepEqual(p.building, { new: { unit_id: 'unit1', name: 'Annex' } });
  assert.equal(p.event_id, null);
  assert.deepEqual(p.answers, [{ item_id: 'III/2', answer: null, remarks: 'Hinges loose' }]);
  assert.deepEqual(p.comments, [{ section_id: 'III', comment: 'Check doors' }]);
  assert.equal(p.ended_at, '2026-10-20T02:00:00.000Z');
  assert.equal(p.evaluator_id, 'u1');
});

test('choosing a building takes its saved profile and keeps the answers', () => {
  const d = draft({ answers: { [id('II.1')]: { answer: 'yes' } } });
  const next = applyBuildingProfile(d, {
    id: 'b1',
    unit_id: 'unit1',
    name: 'Main',
    floor_count: 4,
    area_type_ids: ['offices'],
    last_assessed_at: '2026-01-05T00:00:00.000Z',
  });
  assert.deepEqual(
    [next.building_id, next.building_name, next.floor_count, next.prefilled_from],
    ['b1', 'Main', 4, '2026-01-05T00:00:00.000Z']
  );
  assert.deepEqual(next.area_type_ids, ['offices']);
  assert.deepEqual(next.answers, d.answers);
});

test('steps skip sections with nothing to ask', () => {
  assert.deepEqual(draftSteps(T, draft()), [
    'details',
    'building',
    'section:I',
    'section:II',
    'section:III',
    'section:IV',
    'section:V',
    'section:VI',
    'section:VIII',
    'section:X',
    'review',
  ]);
});

test('newUuid is a v4 uuid', () => {
  assert.match(newUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
