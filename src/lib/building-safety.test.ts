import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import { applicableItems, scoreAssessment, type Tally } from './assessment-score';
import {
  templateFromData,
  type AnswerValue,
  type AssessmentTemplate,
  type BuildingScores,
  type ScoredAssessment,
} from './assessment-template';
import {
  comparePair,
  compareScores,
  groupChildren,
  mostFailed,
  pointsChange,
  poolBuildings,
  scopeFromParams,
  scoresFromPillarRows,
  sectionScores,
  type AnswerFact,
} from './building-safety';

test('pillar rows add up to the overall score', () => {
  const s = scoresFromPillarRows([
    { code: 'prevention-mitigation', safe_count: 17, counted_count: 19, na_count: 0 },
    { code: 'preparedness', safe_count: 13, counted_count: 13, na_count: 1 },
    { code: 'response', safe_count: 9, counted_count: 9, na_count: 0 },
    { code: 'rehabilitation-recovery', safe_count: 1, counted_count: 1, na_count: 0 },
  ]);
  assert.deepEqual(s.overall, { safe: 40, counted: 42, na: 1 });
  assert.deepEqual(s.pillars.preparedness, { safe: 13, counted: 13, na: 1 });
  assert.deepEqual(scoresFromPillarRows([]).pillars.response, { safe: 0, counted: 0, na: 0 });
});

test('change is in points, and nothing counted means no change', () => {
  assert.equal(pointsChange({ safe: 5, counted: 10, na: 0 }, { safe: 8, counted: 10, na: 0 }), 30);
  assert.equal(pointsChange({ safe: 8, counted: 10, na: 0 }, { safe: 5, counted: 10, na: 0 }), -30);
  assert.equal(pointsChange(null, { safe: 1, counted: 1, na: 0 }), null);
  assert.equal(pointsChange({ safe: 0, counted: 0, na: 3 }, { safe: 1, counted: 1, na: 0 }), null);
});

/* ─── Rollup (Part B) ─── */

const tally = (safe: number, counted: number, na = 0): Tally => ({ safe, counted, na });
let seq = 0;
/** An assessment scoring safe of counted, all in Prevention, with the Continuity Plan in or out. */
function s(safe: number, counted: number, pscp: 'in' | 'out' = 'in'): ScoredAssessment {
  seq += 1;
  return {
    id: `a${seq}`,
    ended_at: `2026-0${(seq % 9) + 1}-01T00:00:00.000Z`,
    evaluator_name: 'E',
    needs_follow_up: false,
    event_name: null,
    overall: tally(safe, counted),
    pillars: {
      'prevention-mitigation': tally(safe, counted),
      preparedness: tally(0, 0),
      response: tally(0, 0),
      'rehabilitation-recovery': pscp === 'in' ? tally(1, 1) : tally(0, 1),
    },
  };
}

function building(
  id: string,
  unit: string,
  cluster: string,
  latest: ScoredAssessment | null = null,
  previous: ScoredAssessment | null = null
): BuildingScores {
  return {
    id,
    name: id,
    floor_count: 1,
    unit: { id: unit, name: unit },
    cluster: { id: cluster, name: cluster },
    campus: { id: 'campus', name: 'UP Test' },
    assessment_count: (latest ? 1 : 0) + (previous ? 1 : 0),
    latest,
    previous,
  };
}

test('pooled current counts every latest; the change only re-assessed buildings', () => {
  const g = poolBuildings([
    building('A', 'u1', 'c1', s(8, 10), s(5, 10)),
    building('B', 'u1', 'c1', s(10, 10)),
    building('C', 'u2', 'c1'),
  ]);
  assert.deepEqual([g.buildings, g.assessed, g.reassessed], [3, 2, 1]);
  assert.deepEqual(g.current.overall, { safe: 18, counted: 20, na: 0 });
  assert.equal(pointsChange(g.likeForLike!.previous.overall, g.likeForLike!.current.overall), 30);
});

test('no re-assessed building: no change at all', () => {
  const g = poolBuildings([building('B', 'u1', 'c1', s(1, 1))]);
  assert.equal(g.likeForLike, null);
  assert.equal(g.pscp.change, null);
});

test('an older assessment of a building never counts toward the tiles', () => {
  const g = poolBuildings([building('A', 'u1', 'c1', s(10, 10), s(0, 10))]);
  assert.deepEqual(g.current.overall, { safe: 10, counted: 10, na: 0 });
});

test('continuity plan: n of m buildings, and the change among re-assessed ones', () => {
  const g = poolBuildings([
    building('A', 'u1', 'c1', s(1, 1, 'in'), s(1, 1, 'out')),
    building('B', 'u1', 'c1', s(1, 1, 'out')),
  ]);
  assert.deepEqual(g.pscp, { has: 1, of: 2, change: 1 });
});

test('children follow the level', () => {
  const bs = [
    building('A', 'u1', 'c1', s(1, 1)),
    building('B', 'u2', 'c1'),
    building('C', 'u3', 'c2'),
  ];
  assert.deepEqual(
    groupChildren(bs, 'campus').map((c) => [c.kind, c.id, c.buildings]),
    [
      ['cluster', 'c1', 2],
      ['cluster', 'c2', 1],
    ]
  );
  assert.deepEqual(
    groupChildren(bs, 'cluster').map((c) => [c.kind, c.id]),
    [
      ['unit', 'u1'],
      ['unit', 'u2'],
      ['unit', 'u3'],
    ]
  );
  assert.deepEqual(
    groupChildren(bs, 'unit').map((c) => c.kind),
    ['building', 'building', 'building']
  );
  assert.deepEqual(
    groupChildren(bs, 'all').map((c) => [c.kind, c.id, c.buildings]),
    [['campus', 'campus', 3]]
  );
});

function fact(assessment_id: string, label: string, answer: AnswerValue, order = 1): AnswerFact {
  const section = label.split('.')[0];
  return {
    assessment_id,
    section_code: section,
    section_order: order,
    section_title_en: `${section} en`,
    section_title_fil: `${section} fil`,
    label,
    prompt_en: `${label} en`,
    prompt_fil: `${label} fil`,
    pillar_code: 'response',
    answer,
    safe_answer: 'yes',
  };
}

test('most failed: per pillar, out of the buildings that answered it', () => {
  const facts = [
    fact('a1', 'V.4', 'no'),
    fact('a2', 'V.4', 'no'),
    fact('a3', 'V.4', 'yes'),
    fact('a3', 'II.1', 'na'),
    fact('old', 'V.4', 'no'),
  ];
  const groups = mostFailed(facts, ['a1', 'a2', 'a3']);
  assert.deepEqual(
    groups.map((g) => g.pillar),
    ['response']
  );
  assert.deepEqual(groups[0].items, [
    { label: 'V.4', prompt_en: 'V.4 en', prompt_fil: 'V.4 fil', unsafe: 2, of: 3 },
  ]);
});

test('section scores: current over the latest, change like-for-like', () => {
  const facts = [
    fact('cur1', 'I.1', 'yes', 1),
    fact('cur1', 'I.2', 'yes', 1),
    fact('cur2', 'I.1', 'no', 1),
    fact('prev1', 'I.1', 'no', 1),
    fact('prev1', 'I.2', 'no', 1),
    fact('cur1', 'V.4', 'yes', 5),
  ];
  const rows = sectionScores(facts, {
    current: ['cur1', 'cur2'],
    lflCurrent: ['cur1'],
    lflPrevious: ['prev1'],
  });
  assert.deepEqual(
    rows.map((r) => [r.code, r.current, r.change]),
    [
      ['I', tally(2, 3), 100],
      ['V', tally(1, 1), null],
    ]
  );
});

const T = templateFromData(MATATAG_2025_07_25);
const allYes = (template: AssessmentTemplate, floors: number, areas: string[]) =>
  scoreAssessment(
    template,
    floors,
    areas,
    Object.fromEntries(applicableItems(template, floors, areas).map((i) => [i.id, 'yes' as const]))
  );

test('compare: a section only in B has no change; different versions are flagged', () => {
  const sideA = { template: T, score: allYes(T, 1, []) };
  const TB = { ...T, version_id: 'other' };
  const sideB = { template: TB, score: allYes(TB, 1, ['laboratories']) };
  const c = compareScores(sideA, sideB);
  const labs = c.sections.find((r) => r.key === 'XIII')!;
  assert.equal(labs.a, null);
  assert.notEqual(labs.b, null);
  assert.equal(labs.change, null);
  assert.equal(c.versionsDiffer, true);
  assert.equal(c.pillars.length, 4);
  assert.equal(compareScores(sideA, sideA).versionsDiffer, false);
  assert.equal(c.sections.find((r) => r.key === 'I')!.change, 0);
});

test('compare pair: defaults, and bad picks fall back', () => {
  const h = ['n1', 'n2', 'n3', 'n4'];
  assert.deepEqual(comparePair(h), { a: 'n3', b: 'n4' });
  assert.deepEqual(comparePair(h, 'n1', 'n4'), { a: 'n1', b: 'n4' });
  assert.deepEqual(comparePair(h, 'n4', 'n4'), { a: 'n3', b: 'n4' });
  assert.deepEqual(comparePair(h, 'zzz', 'n2'), { a: 'n3', b: 'n2' });
  assert.deepEqual(comparePair(h, null, 'n3'), { a: 'n4', b: 'n3' });
  assert.deepEqual(comparePair(['n1']), { a: null, b: 'n1' });
  assert.deepEqual(comparePair([]), { a: null, b: null });
});

test('an administrator never picks the campus from the URL', () => {
  const p = new URLSearchParams('bs_campus=other&bs_cluster=c1&bs_a=x');
  const admin = scopeFromParams(p, { isSuperAdmin: false, switcherCampusId: '' });
  assert.equal(admin.campusId, null);
  assert.equal(admin.clusterId, 'c1');
  assert.equal(admin.a, 'x');
  assert.equal(
    scopeFromParams(p, { isSuperAdmin: true, switcherCampusId: 'sw' }).campusId,
    'other'
  );
  const none = new URLSearchParams();
  assert.equal(
    scopeFromParams(none, { isSuperAdmin: true, switcherCampusId: 'sw' }).campusId,
    'sw'
  );
  assert.equal(scopeFromParams(none, { isSuperAdmin: true, switcherCampusId: '' }).campusId, null);
});
