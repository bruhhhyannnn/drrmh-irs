import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import {
  applyBuildingProfile,
  clampFloors,
  draftFromPayload,
  draftSteps,
  newDraft,
  newUuid,
  parseFloors,
  sectionProgress,
  sectionScoredItems,
  setAsideCount,
  stepQuestion,
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

test('a queued payload opens again as the same draft (review I2)', () => {
  const d = draft({
    building_id: '',
    new_building_name: 'Annex',
    floor_count: 3,
    area_type_ids: ['bathrooms'],
    event_id: 'e1',
    incident_commander: 'Dr. Cruz',
    answers: { [id('II.1')]: { answer: 'yes' }, 'III/2': { remarks: 'Hinges loose' } },
    comments: { III: 'Check doors' },
  });
  const payload = toPayload(T, d, new Date('2026-10-20T02:00:00Z'));
  const reopened = draftFromPayload(payload, {
    campus_id: 'c1',
    cluster_id: 'k1',
    unit_id: 'unit1',
    building_name: '',
    now: new Date('2026-10-21T00:00:00Z'),
  });
  assert.equal(reopened.step, 'review');
  assert.equal(reopened.client_ref, d.client_ref);
  assert.equal(reopened.unit_id, 'unit1');
  assert.deepEqual(toPayload(T, reopened, new Date('2026-10-20T02:00:00Z')), payload);
});

test('typed floors: blank is "not yet", the rest is clamped (review I5)', () => {
  assert.deepEqual(['', '  ', 'abc', '0', '2.5', '12', '500'].map(parseFloors), [
    null,
    null,
    null,
    1,
    3,
    12,
    200,
  ]);
});

test('newUuid is a v4 uuid', () => {
  assert.match(newUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('flashcard question stepping walks one scored question at a time across sections', () => {
  const d = draft({ floor_count: 1, area_type_ids: [] });
  const secI = sectionScoredItems(T, d, 'I');
  const secII = sectionScoredItems(T, d, 'II');
  assert.equal(secI.length, 12);
  assert.equal(secI[0].id, id('I.1'));
  assert.equal(secI[2].id, id('I.3.1'));

  // From building, Next lands on the first question of Section I.
  const fromBuilding = stepQuestion(T, { ...d, step: 'building' }, 'next');
  assert.deepEqual(fromBuilding, { step: 'section:I', item_id: secI[0].id });

  // From Section I Q1, Next goes to Q2; Back goes back to building.
  assert.deepEqual(stepQuestion(T, { ...d, step: 'section:I', item_id: secI[0].id }, 'next'), {
    step: 'section:I',
    item_id: secI[1].id,
  });
  assert.deepEqual(stepQuestion(T, { ...d, step: 'section:I', item_id: secI[0].id }, 'prev'), {
    step: 'building',
    item_id: undefined,
  });

  // From the last question of Section I, Next goes to Section II Q1; Back from Section II Q1 returns to Section I's last question.
  const lastI = secI[secI.length - 1].id;
  assert.deepEqual(stepQuestion(T, { ...d, step: 'section:I', item_id: lastI }, 'next'), {
    step: 'section:II',
    item_id: secII[0].id,
  });
  assert.deepEqual(stepQuestion(T, { ...d, step: 'section:II', item_id: secII[0].id }, 'prev'), {
    step: 'section:I',
    item_id: lastI,
  });

  // From review, Back lands on the last question of the last applicable section (X).
  const secX = sectionScoredItems(T, d, 'X');
  assert.deepEqual(stepQuestion(T, { ...d, step: 'review' }, 'prev'), {
    step: 'section:X',
    item_id: secX[secX.length - 1].id,
  });
});
