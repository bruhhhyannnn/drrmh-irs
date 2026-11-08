import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import {
  answerFilterOf,
  applyBuildingProfile,
  clampFloors,
  detailsFromDraft,
  draftFromPayload,
  draftSteps,
  locationKindOf,
  newDraft,
  newUuid,
  parseFloors,
  searchQuestions,
  sectionProgress,
  sectionScoredItems,
  setAsideCount,
  stepQuestion,
  toPayload,
  type AssessmentDraft,
} from './assessment-draft';
import { templateFromData } from './assessment-template';
import { assessmentDetailsSchema } from './schemas';

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
    barangay_code: null,
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

/* ─── Off campus (DRRM-025) ─── */

const offCampus = (patch: Partial<AssessmentDraft> = {}) =>
  draft({
    location_kind: 'off_campus',
    region_code: '1300000000',
    province_code: '',
    city_code: '1380600000',
    barangay_code: '1380601001',
    new_building_name: ' Annex ',
    ...patch,
  });

test('a draft saved before off-campus existed counts as campus', () => {
  const saved = draft();
  delete saved.location_kind;
  assert.equal(locationKindOf(saved), 'campus');
});

test('a new draft has no location chosen', () => {
  assert.equal(locationKindOf(draft()), null);
});

test('detailsFromDraft fills in what an older draft lacks', () => {
  const saved = draft({ building_id: 'b1' });
  delete saved.location_kind;
  delete saved.region_code;
  delete saved.barangay_code;
  const details = detailsFromDraft(saved);
  assert.equal(details.location_kind, 'campus');
  assert.equal(details.region_code, '');
  assert.equal(details.barangay_code, '');
  assert.equal(details.building_id, 'b1');
  assert.equal(assessmentDetailsSchema.safeParse(details).success, true);
});

test('toPayload sends a new off-campus building by barangay code', () => {
  assert.deepEqual(toPayload(T, offCampus(), new Date()).building, {
    new_off_campus: {
      barangay_code: '1380601001',
      name: 'Annex',
      latitude: null,
      longitude: null,
      location_name: null,
    },
  });
});

test('toPayload carries the pin with a new off-campus building', () => {
  const { building } = toPayload(
    T,
    offCampus({ pin: { lat: 14.5, lng: 120.9, name: 'Padre Faura' } }),
    new Date()
  );
  assert.deepEqual('new_off_campus' in building && building.new_off_campus, {
    barangay_code: '1380601001',
    name: 'Annex',
    latitude: 14.5,
    longitude: 120.9,
    location_name: 'Padre Faura',
  });
});

test('toPayload sends a saved off-campus building by id', () => {
  const d = offCampus({ building_id: 'b1', new_building_name: '' });
  assert.deepEqual(toPayload(T, d, new Date()).building, { id: 'b1' });
});

test('draftFromPayload restores a new off-campus building and its pin', () => {
  const d = offCampus({ pin: { lat: 14.5, lng: 120.9, name: 'Padre Faura' } });
  const payload = toPayload(T, d, new Date('2026-10-20T02:00:00Z'));
  const reopened = draftFromPayload(payload, {
    campus_id: 'c1',
    cluster_id: '',
    unit_id: '',
    building_name: '',
    now: new Date('2026-10-21T00:00:00Z'),
  });
  assert.equal(reopened.location_kind, 'off_campus');
  assert.equal(reopened.barangay_code, '1380601001');
  assert.equal(reopened.new_building_name, 'Annex');
  assert.deepEqual(reopened.pin, { lat: 14.5, lng: 120.9, name: 'Padre Faura' });
  assert.deepEqual(toPayload(T, reopened, new Date('2026-10-20T02:00:00Z')), payload);
});

test('draftFromPayload takes a saved building’s category from the caller', () => {
  const payload = toPayload(
    T,
    offCampus({ building_id: 'b1', new_building_name: '' }),
    new Date('2026-10-20T02:00:00Z')
  );
  const reopened = draftFromPayload(payload, {
    campus_id: 'c1',
    cluster_id: '',
    unit_id: '',
    building_name: 'Main',
    location_kind: 'off_campus',
    barangay_code: '1380601001',
    now: new Date('2026-10-21T00:00:00Z'),
  });
  assert.equal(reopened.location_kind, 'off_campus');
  assert.equal(reopened.barangay_code, '1380601001');
});

test('draftFromPayload treats a queued campus building as campus', () => {
  const payload = toPayload(T, draft({ new_building_name: 'Annex' }), new Date());
  const reopened = draftFromPayload(payload, {
    campus_id: 'c1',
    cluster_id: 'k1',
    unit_id: 'unit1',
    building_name: '',
    now: new Date(),
  });
  assert.equal(locationKindOf(reopened), 'campus');
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

test('search finds the questions that apply, in form order, by every word of the query', () => {
  const ids = (d: AssessmentDraft, q: string) => searchQuestions(T, d, q).map((m) => m.item.id);
  const withBathrooms = draft({ floor_count: 2, area_type_ids: ['bathrooms'] });

  // In form order, and a blank query lists every question that applies.
  const all = draftSteps(T, withBathrooms).flatMap((s) =>
    s.startsWith('section:')
      ? sectionScoredItems(T, withBathrooms, s.slice(8)).map((i) => i.id)
      : []
  );
  assert.deepEqual(ids(withBathrooms, '   '), all);
  assert.ok(!ids(draft({ floor_count: 2 }), 'bathrooms').includes(id('III.2.1')));

  const bathrooms = ids(withBathrooms, 'bathrooms');
  assert.ok(bathrooms.includes(id('III.2.1')));
  assert.deepEqual(
    bathrooms,
    all.filter((i) => bathrooms.includes(i))
  );

  // The group's shared prompt narrows a sub-item down; Filipino, case and the label all match.
  const doors = ids(withBathrooms, 'doors  BATHROOMS');
  assert.ok(doors.includes(id('III.2.1')) && doors.length < bathrooms.length);
  assert.ok(ids(withBathrooms, 'palikuran').includes(id('III.2.1')));
  assert.ok(ids(withBathrooms, 'iii.2.1').includes(id('III.2.1')));
});

test('a question falls under its answer filter, or "unanswered" until it has one', () => {
  const d = draft({ answers: { a: { answer: 'no' }, b: { remarks: 'cracked' } } });
  assert.deepEqual(
    ['a', 'b', 'c'].map((i) => answerFilterOf(d, i)),
    ['no', 'unanswered', 'unanswered']
  );
});
