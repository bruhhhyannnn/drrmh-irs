import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import {
  applicableItems,
  areaQuestionCounts,
  percent,
  prepareAssessmentWrite,
  recoveryStatus,
  scoreAssessment,
  unsafeByPillar,
} from './assessment-score';
import {
  AREA_CODES,
  PILLAR_CODES,
  templateFromData,
  type AnswerValue,
} from './assessment-template';

// Applicability and scoring checked against the real checklist (spec Sections 3.3–3.4 and 4).

const T = templateFromData(MATATAG_2025_07_25);
const id = (label: string) => label.replace('.', '/'); // 'III.4.1' → 'III/4.1'
const scoredCount = (floors: number, areas: readonly string[]) =>
  applicableItems(T, floors, areas).filter((i) => i.is_scored).length;
const OFFICE = ['offices'];

test('pre-screen counts from the spec (Sections 3.3–3.4)', () => {
  assert.equal(scoredCount(1, []), 42);
  assert.equal(scoredCount(2, ['corridors', 'bathrooms', 'offices', 'stairwells']), 93);
  assert.equal(
    scoredCount(4, [
      'corridors',
      'bathrooms',
      'offices',
      'classrooms',
      'laboratories',
      'stairwells',
    ]),
    145
  );
  assert.equal(
    scoredCount(4, ['corridors', 'bathrooms', 'offices', 'dormitories', 'stairwells']),
    128
  );
  assert.equal(scoredCount(3, AREA_CODES), 211);
});

test('sprinklers need 3 floors; a group parent needs an applicable sub-item', () => {
  const two = applicableItems(T, 2, ['corridors', 'dormitories']).map((i) => i.id);
  assert.ok(!two.includes(id('V.6.1')) && !two.includes(id('XVII.13')) && !two.includes('V/6'));
  const three = applicableItems(T, 3, ['corridors', 'dormitories']).map((i) => i.id);
  assert.ok(three.includes(id('V.6.1')) && three.includes(id('XVII.13')) && three.includes('V/6'));
  assert.ok(!applicableItems(T, 3, ['corridors']).some((i) => i.id === 'III/2'));
  assert.ok(applicableItems(T, 3, ['bathrooms']).some((i) => i.id === 'III/2'));
});

test('questions each area adds', () => {
  assert.deepEqual(areaQuestionCounts(T, 3), {
    corridors: 11,
    bathrooms: 19,
    offices: 17,
    classrooms: 21,
    laboratories: 28,
    athletic: 17,
    dormitories: 32,
    playground: 13,
    swimming_pool: 4,
    stairwells: 7,
  });
  const two = areaQuestionCounts(T, 2);
  assert.deepEqual([two.corridors, two.bathrooms, two.dormitories], [10, 18, 30]);
});

test('reverse items: NO is safe on II.3; YES on VI.1.3 needs structural follow-up', () => {
  const score = (answers: Record<string, AnswerValue>) => scoreAssessment(T, 1, OFFICE, answers);
  assert.equal(score({ [id('II.3')]: 'no' }).overall.safe, 1);
  assert.equal(score({ [id('II.3')]: 'yes' }).overall.safe, 0);
  const cracked = score({ [id('VI.1.3')]: 'yes' });
  assert.equal(cracked.needsFollowUp, true);
  assert.deepEqual(
    cracked.unsafe.map((i) => i.id),
    [id('VI.1.3')]
  );
  assert.equal(score({ [id('VI.1.3')]: 'no' }).needsFollowUp, false);
});

test('N/A and non-applicable answers are left out', () => {
  const s = scoreAssessment(T, 1, OFFICE, {
    [id('II.1')]: 'na',
    [id('II.2')]: 'yes',
    [id('XIII.1')]: 'no',
  });
  assert.deepEqual(s.overall, { safe: 1, counted: 1, na: 1 });
  assert.equal(s.sections['XIII'], undefined);
});

test('the four pillars add up to the overall score', () => {
  const values: AnswerValue[] = ['no', 'yes', 'na'];
  const scored = applicableItems(T, 4, AREA_CODES).filter((i) => i.is_scored);
  const s = scoreAssessment(
    T,
    4,
    AREA_CODES,
    Object.fromEntries(scored.map((i, k) => [i.id, values[k % 3]]))
  );
  const sum = PILLAR_CODES.reduce(
    (t, p) => ({
      safe: t.safe + s.pillars[p].safe,
      counted: t.counted + s.pillars[p].counted,
      na: t.na + s.pillars[p].na,
    }),
    { safe: 0, counted: 0, na: 0 }
  );
  assert.deepEqual(sum, s.overall);
  assert.equal(s.unanswered.length, 0);
});

test('unanswered = applicable scored items without an answer', () => {
  assert.equal(scoreAssessment(T, 1, OFFICE, {}).unanswered.length, scoredCount(1, OFFICE));
});

test('percent and recovery status', () => {
  assert.equal(percent({ safe: 0, counted: 0, na: 3 }), null);
  assert.equal(percent({ safe: 2, counted: 3, na: 0 }), 67);
  assert.equal(recoveryStatus({ safe: 1, counted: 1, na: 0 }), 'in_place');
  assert.equal(recoveryStatus({ safe: 0, counted: 1, na: 0 }), 'missing');
  assert.equal(recoveryStatus({ safe: 0, counted: 0, na: 1 }), 'na');
});

test('one unsafe answer never reads 100% (review)', () => {
  assert.equal(percent({ safe: 210, counted: 211, na: 0 }), 99);
  assert.equal(percent({ safe: 211, counted: 211, na: 0 }), 100);
});

test('unsafe items grouped by pillar, in pillar order (spec 4.2)', () => {
  const s = scoreAssessment(T, 1, OFFICE, {
    [id('I.9')]: 'no',
    [id('II.3')]: 'yes',
    [id('II.1')]: 'no',
    [id('II.2')]: 'yes',
  });
  assert.deepEqual(
    unsafeByPillar(s).map((g) => [g.pillar, g.items.map((i) => i.id)]),
    [
      ['prevention-mitigation', [id('II.1'), id('II.3')]],
      ['response', [id('I.9')]],
    ]
  );
});

test('prepareAssessmentWrite keeps only what applies and counts what is missing', () => {
  const p = prepareAssessmentWrite(T, {
    floor_count: 1,
    area_type_ids: OFFICE,
    answers: [
      { item_id: id('II.1'), answer: 'yes', remarks: '  ' },
      { item_id: id('XIII.1'), answer: 'no', remarks: null }, // no labs
      { item_id: 'III/2', answer: 'yes', remarks: 'Door sticks' }, // group parent
      { item_id: 'unknown', answer: 'yes', remarks: null },
    ],
    comments: [
      { section_id: 'II', comment: ' Ok ' },
      { section_id: 'XIII', comment: 'x' },
    ],
  });
  assert.deepEqual(p.answers, [
    { item_id: id('II.1'), answer: 'yes', remarks: null },
    { item_id: 'III/2', answer: null, remarks: 'Door sticks' },
  ]);
  assert.deepEqual(p.comments, [{ section_id: 'II', comment: 'Ok' }]);
  assert.equal(p.missing, scoredCount(1, OFFICE) - 1);
  assert.equal(p.pillarTallies['prevention-mitigation'].safe, 1);
});
