import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tally } from './assessment-score';
import type { BuildingScores, PillarCode, ScoredAssessment } from './assessment-template';
import type { AnswerFact } from './building-safety';
import {
  changeCounts,
  failingBuildings,
  monthlyActivity,
  overdueBuildings,
  pillarTrends,
  quarterlyTrend,
  scoreBands,
  type HistoryRow,
} from './pillar-trends';

// The pillar page's trends (DRRM-027): score bands, better/same/worse, quarterly score, monthly
// activity, overdue buildings and which buildings fail an item. Dates group in Philippine time.

const P: PillarCode = 'prevention-mitigation';
const t = (safe: number, counted: number, na = 0): Tally => ({ safe, counted, na });

function scored(
  id: string,
  prevention: Tally,
  ended_at = '2026-10-01T00:00:00.000Z'
): ScoredAssessment {
  return {
    id,
    ended_at,
    evaluator_name: 'E',
    needs_follow_up: false,
    event_name: null,
    overall: prevention,
    pillars: {
      'prevention-mitigation': prevention,
      preparedness: t(0, 0),
      response: t(0, 0),
      'rehabilitation-recovery': t(0, 1),
    },
  };
}

function building(
  id: string,
  latest: ScoredAssessment | null,
  previous: ScoredAssessment | null = null
): BuildingScores {
  return {
    id,
    name: id,
    floor_count: 1,
    category: 'campus',
    unit: { id: 'u', name: 'Unit' },
    cluster: { id: 'k', name: 'Cluster' },
    campus: { id: 'c', name: 'UP Test' },
    location: null,
    label: 'Unit',
    assessment_count: (latest ? 1 : 0) + (previous ? 1 : 0),
    latest,
    previous,
  };
}

const names = (list: { id: string }[]) => list.map((b) => b.id);

test('score bands split at 50, 70 and 85 percent', () => {
  const { bands } = scoreBands(
    [
      building('49', scored('a', t(49, 100))),
      building('50', scored('b', t(50, 100))),
      building('69', scored('c', t(69, 100))),
      building('70', scored('d', t(70, 100))),
      building('84', scored('e', t(84, 100))),
      building('85', scored('f', t(85, 100))),
    ],
    P
  );
  assert.deepEqual(
    bands.map((b) => [b.band, names(b.buildings)]),
    [
      ['below_50', ['49']],
      ['from_50', ['50', '69']],
      ['from_70', ['70', '84']],
      ['from_85', ['85']],
    ]
  );
  assert.deepEqual(
    bands.map((b) => b.label),
    ['Below 50%', '50–69%', '70–84%', '85%+']
  );
});

test('a building that counted nothing in the pillar has no score, not a low one', () => {
  const result = scoreBands(
    [building('all-na', scored('a', t(0, 0, 9))), building('never', null)],
    P
  );
  assert.equal(result.noScore, 1);
  assert.ok(result.bands.every((b) => b.buildings.length === 0));
});

test('better, same or worse compares rounded percents', () => {
  const result = changeCounts(
    [
      building('up', scored('a2', t(9, 10)), scored('a1', t(5, 10))),
      building('flat', scored('b2', t(501, 1000)), scored('b1', t(499, 1000))),
      building('down', scored('c2', t(2, 10)), scored('c1', t(8, 10))),
      building('once', scored('d', t(5, 10))),
    ],
    P
  );
  assert.deepEqual(names(result.better), ['up']);
  assert.deepEqual(names(result.same), ['flat']);
  assert.deepEqual(names(result.worse), ['down']);
});

const row = (building_id: string, ended_at: string, safe: number, counted: number): HistoryRow => ({
  building_id,
  ended_at,
  tally: t(safe, counted),
});

test('the quarterly trend pools each building’s latest assessment as of each quarter’s end', () => {
  const trend = quarterlyTrend(
    [
      row('A', '2026-02-10T00:00:00.000Z', 5, 10),
      row('A', '2026-08-10T00:00:00.000Z', 9, 10),
      row('B', '2026-05-10T00:00:00.000Z', 6, 10),
    ],
    new Date('2026-11-06T00:00:00.000Z'),
    8
  );
  assert.deepEqual(
    trend.map((q) => q.label),
    ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026']
  );
  assert.deepEqual(
    trend.map((q) => q.tally),
    [t(5, 10), t(11, 20), t(15, 20), t(15, 20)]
  );
});

test('quarters and months follow Philippine time', () => {
  const late = [row('A', '2026-03-31T20:00:00.000Z', 1, 1)];
  const now = new Date('2026-04-15T00:00:00.000Z');
  assert.deepEqual(
    quarterlyTrend(late, now).map((q) => q.label),
    ['Q2 2026']
  );
  const months = monthlyActivity(late, now, 2);
  assert.deepEqual(months, [
    { label: 'Mar', count: 0 },
    { label: 'Apr', count: 1 },
  ]);
});

test('monthly activity counts assessments per month, oldest first', () => {
  const months = monthlyActivity(
    [
      row('A', '2026-10-02T00:00:00.000Z', 1, 1),
      row('B', '2026-10-20T00:00:00.000Z', 1, 1),
      row('A', '2026-11-01T00:00:00.000Z', 1, 1),
    ],
    new Date('2026-11-06T00:00:00.000Z'),
    3
  );
  assert.deepEqual(months, [
    { label: 'Sep', count: 0 },
    { label: 'Oct', count: 2 },
    { label: 'Nov', count: 1 },
  ]);
});

test('overdue means assessed more than 365 days ago; never assessed is not overdue', () => {
  const now = new Date('2026-11-06T00:00:00.000Z');
  const result = overdueBuildings(
    [
      building('old', scored('a', t(1, 1), '2025-11-05T00:00:00.000Z')),
      building('recent', scored('b', t(1, 1), '2025-11-07T00:00:00.000Z')),
      building('never', null),
    ],
    now
  );
  assert.deepEqual(names(result), ['old']);
});

function fact(
  assessment_id: string,
  label: string,
  answer: AnswerFact['answer'],
  pillar_code: PillarCode = P
): AnswerFact {
  return {
    assessment_id,
    section_code: 'I',
    section_order: 1,
    section_title_en: 'I',
    section_title_fil: 'I',
    label,
    prompt_en: label,
    prompt_fil: label,
    pillar_code,
    answer,
    safe_answer: 'yes',
  };
}

test('failing buildings list the latest assessments’ unsafe answers in this pillar', () => {
  const buildingOf = new Map([
    ['a', { id: 'A', name: 'A', label: 'Unit', category: 'campus' as const }],
    ['b', { id: 'B', name: 'B', label: 'Unit', category: 'campus' as const }],
  ]);
  const result = failingBuildings(
    [
      fact('a', 'VI.9', 'no'),
      fact('b', 'VI.9', 'yes'),
      fact('old', 'VI.9', 'no'),
      fact('a', 'II.3', 'na'),
      fact('b', 'V.1', 'no', 'response'),
    ],
    ['a', 'b'],
    buildingOf,
    P
  );
  assert.deepEqual(Object.keys(result), ['VI.9']);
  assert.deepEqual(names(result['VI.9']), ['A']);
});

test('empty inputs give empty results', () => {
  const now = new Date('2026-11-06T00:00:00.000Z');
  assert.equal(scoreBands([], P).noScore, 0);
  assert.deepEqual(changeCounts([], P), { worse: [], same: [], better: [] });
  assert.deepEqual(quarterlyTrend([], now), []);
  assert.deepEqual(
    monthlyActivity([], now, 2).map((m) => m.count),
    [0, 0]
  );
  assert.deepEqual(overdueBuildings([], now), []);
});

test('pillarTrends gathers the page’s extra fields for one group', () => {
  const now = new Date('2026-11-06T00:00:00.000Z');
  const flagged = { ...scored('a', t(4, 10), '2026-10-01T00:00:00.000Z'), needs_follow_up: true };
  const fields = pillarTrends({
    buildings: [building('A', flagged), building('never', null)],
    history: [row('A', '2026-10-01T00:00:00.000Z', 4, 10)],
    facts: [fact('a', 'VI.9', 'no')],
    currentIds: ['a'],
    pillar: P,
    now,
  });
  assert.equal(fields.needsFollowUp, 1);
  assert.equal(fields.notYetAssessed, 1);
  assert.deepEqual(names(fields.failing['VI.9']), ['A']);
  assert.deepEqual(names(fields.bands.bands[0].buildings), ['A']);
  assert.equal(fields.trend.at(-1)?.label, 'Q4 2026');
  assert.equal(fields.activity.at(-1)?.count, 0);
  assert.equal(fields.activity.at(-2)?.count, 1);
});
