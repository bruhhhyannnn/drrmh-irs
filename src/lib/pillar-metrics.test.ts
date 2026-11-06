import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BuildingScores, PillarCode, ScoredAssessment } from './assessment-template';
import { poolBuildings, type AnswerFact } from './building-safety';
import { lowestBuildings, mostNa, naRate, pillarGroup, recoveryGroup } from './pillar-metrics';

const tally = (safe: number, counted: number, na = 0) => ({ safe, counted, na });
const PREVENTION: PillarCode = 'prevention-mitigation';

function scored(id: string, prevention = tally(0, 0), recovery = tally(0, 1)): ScoredAssessment {
  return {
    id,
    ended_at: '2026-10-20T00:00:00.000Z',
    evaluator_name: 'E',
    needs_follow_up: false,
    event_name: null,
    overall: prevention,
    pillars: {
      'prevention-mitigation': prevention,
      preparedness: tally(0, 0),
      response: tally(0, 0),
      'rehabilitation-recovery': recovery,
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
    assessment_count: 1,
    latest,
    previous,
  };
}

function fact(
  assessment_id: string,
  label: string,
  answer: AnswerFact['answer'],
  pillar_code: PillarCode = PREVENTION,
  section_code = 'I'
): AnswerFact {
  return {
    assessment_id,
    section_code,
    section_order: 1,
    section_title_en: section_code,
    section_title_fil: section_code,
    label,
    prompt_en: label,
    prompt_fil: label,
    pillar_code,
    answer,
    safe_answer: 'yes',
  };
}

test('naRate is N/A over everything answered', () => {
  assert.equal(naRate(tally(6, 8, 2)), 0.2);
});

test('naRate is null when nothing was answered', () => {
  assert.equal(naRate(tally(0, 0, 0)), null);
});

test('mostNa counts only this pillar and the latest assessments', () => {
  const items = mostNa(
    [fact('now', 'I.1', 'na'), fact('now', 'I.2', 'na', 'response'), fact('old', 'I.3', 'na')],
    ['now'],
    PREVENTION
  );
  assert.deepEqual(
    items.map((i) => i.label),
    ['I.1']
  );
});

test('mostNa gives the count and what it is out of', () => {
  const [item] = mostNa(
    [fact('a', 'I.1', 'na'), fact('b', 'I.1', 'yes'), fact('c', 'I.1', 'no')],
    ['a', 'b', 'c'],
    PREVENTION
  );
  assert.equal(item.na, 1);
  assert.equal(item.of, 3);
});

test('mostNa leaves out items nobody marked N/A', () => {
  assert.deepEqual(mostNa([fact('a', 'I.1', 'yes')], ['a'], PREVENTION), []);
});

test('mostNa orders by count, then label, and keeps the limit', () => {
  const items = mostNa(
    [
      fact('a', 'I.3', 'na'),
      fact('a', 'I.2', 'na'),
      fact('a', 'I.1', 'na'),
      fact('b', 'I.3', 'na'),
    ],
    ['a', 'b'],
    PREVENTION,
    2
  );
  assert.deepEqual(
    items.map((i) => i.label),
    ['I.3', 'I.1']
  );
});

test('lowestBuildings puts the lowest first and keeps the limit', () => {
  const rows = lowestBuildings(
    [
      building('High', scored('h', tally(9, 10))),
      building('Low', scored('l', tally(2, 10))),
      building('Mid', scored('m', tally(5, 10))),
    ],
    PREVENTION,
    2
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['Low', 'Mid']
  );
});

test('lowestBuildings skips buildings that counted nothing in this pillar', () => {
  const rows = lowestBuildings(
    [
      building('All NA', scored('n', tally(0, 0, 8))),
      building('Never', null),
      building('Scored', scored('s', tally(5, 10))),
    ],
    PREVENTION
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['Scored']
  );
});

test('pillarGroup pools this pillar, with the N/A rate', () => {
  const group = pillarGroup(
    [building('A', scored('a', tally(6, 8, 1))), building('B', scored('b', tally(2, 2, 1)))],
    [],
    { current: ['a', 'b'], lflCurrent: [], lflPrevious: [] },
    PREVENTION,
    []
  );
  assert.deepEqual(group.tally, tally(8, 10, 2));
  assert.equal(group.assessed, 2);
  assert.equal(group.naRate, 2 / 12);
  assert.equal(group.change, null);
});

test('pillarGroup counts the change only among re-assessed buildings', () => {
  const group = pillarGroup(
    [
      building('A', scored('a2', tally(8, 10)), scored('a1', tally(5, 10))),
      building('B', scored('b', tally(0, 10))),
    ],
    [],
    { current: ['a2', 'b'], lflCurrent: ['a2'], lflPrevious: ['a1'] },
    PREVENTION,
    []
  );
  assert.equal(group.change, 30);
  assert.equal(group.reassessed, 1);
});

test('section scores only include this pillar', () => {
  const group = pillarGroup(
    [building('A', scored('a', tally(1, 1)))],
    [fact('a', 'I.1', 'yes'), fact('a', 'I.2', 'no', 'response')],
    { current: ['a'], lflCurrent: [], lflPrevious: [] },
    PREVENTION,
    []
  );
  assert.deepEqual(group.sections[0].current, tally(1, 1));
});

test('most-failed items only include this pillar', () => {
  const group = pillarGroup(
    [building('A', scored('a', tally(0, 1)))],
    [fact('a', 'I.1', 'no'), fact('a', 'I.2', 'no', 'response')],
    { current: ['a'], lflCurrent: [], lflPrevious: [] },
    PREVENTION,
    []
  );
  assert.deepEqual(
    group.mostFailed.map((i) => i.label),
    ['I.1']
  );
});

test('recoveryGroup counts in place, missing and N/A, and lists the missing buildings', () => {
  const group = recoveryGroup(
    [
      building('Has', scored('a', tally(0, 0), tally(1, 1))),
      building('Lacks', scored('b', tally(0, 0), tally(0, 1))),
      building('Exempt', scored('c', tally(0, 0), tally(0, 0, 1))),
      building('Never', null),
    ],
    []
  );
  assert.equal(group.in_place, 1);
  assert.equal(group.missing, 1);
  assert.equal(group.na, 1);
  assert.deepEqual(group.missingBuildings, [
    { id: 'Lacks', name: 'Lacks', label: 'Unit', category: 'campus' },
  ]);
});

test('lowest buildings carry when they were assessed and whether they need follow-up (DRRM-027)', () => {
  const flagged = { ...scored('a', tally(2, 10)), needs_follow_up: true };
  const [row] = lowestBuildings([building('A', flagged)], PREVENTION);
  assert.equal(row.ended_at, '2026-10-20T00:00:00.000Z');
  assert.equal(row.needs_follow_up, true);
});

test('places carry their change since the previous assessments (DRRM-027)', () => {
  const group = pillarGroup(
    [building('A', scored('a2', tally(8, 10)), scored('a1', tally(5, 10)))],
    [],
    { current: ['a2'], lflCurrent: ['a2'], lflPrevious: ['a1'] },
    PREVENTION,
    [
      {
        id: 'c',
        name: 'UP Test',
        kind: 'campus',
        ...poolBuildings([building('A', scored('a2', tally(8, 10)), scored('a1', tally(5, 10)))]),
      },
    ]
  );
  assert.equal(group.places[0].change, 30);
});
