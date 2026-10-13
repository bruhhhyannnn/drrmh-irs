import { describe, expect, it } from 'vitest';
import {
  buildSummary,
  compareSummaries,
  firstReportScale,
  timelineLabels,
  timelineMilestones,
  timelineOf,
  timelineScale,
  type SummarySource,
} from './summary';

type Report = SummarySource['reports'][number];

/** A time on the drill day, in Philippine time (the test run's time zone). */
const at = (time: string) => new Date(`2026-10-08T${time}:00+08:00`);

const STUDENTS = { id: 'f-students', name: 'Students' };
const FACULTY = { id: 'f-faculty', name: 'Faculty Members' };
const CLUSTERS = [
  { id: 'c-pf', name: 'Padre Faura' },
  { id: 'c-pg', name: 'Pedro Gil' },
  { id: 'c-taft', name: 'Taft' },
];
const LISTS = {
  casualtyConditions: ['Minor injuries', 'Serious injuries', 'Fatality'],
  damageConditions: [
    'No visible damage',
    'Minor damage — cosmetic only',
    'Major structural damage',
  ],
};

function report(id: string, time: string, clusterId: string, rest: Partial<Report> = {}): Report {
  const cluster = CLUSTERS.find((c) => c.id === clusterId)!;
  return {
    id,
    submitted_at: at(time),
    cluster_id: cluster.id,
    unit_id: null,
    cluster: { name: cluster.name },
    unit: null,
    user: { first_name: 'Ana', last_name: 'Reyes' },
    damage_conditions: null,
    population_counts: [],
    casualties: [],
    missing_persons: [],
    ...rest,
  };
}

function source(reports: Report[]): SummarySource {
  return {
    event: {
      id: 'event-q4',
      name: 'Q4 Earthquake Drill',
      description: null,
      quarter: 'Q4 2026',
      started_at: at('09:00'),
      ended_at: at('11:00'),
      campus_id: 'campus-upm',
      campus: { name: 'UP Manila' },
      status: { name: 'Completed' },
      completer: null,
    },
    reports,
    clusters: CLUSTERS,
    fields: [STUDENTS, FACULTY],
  };
}

// Sorted by time, as getEventSummarySource returns them.
const DRILL = source([
  report('r-pf', '09:05', 'c-pf', {
    population_counts: [{ count: 10, category: STUDENTS }],
    damage_conditions: { name: 'No visible damage' },
    casualties: [
      {
        id: 'cas-juan',
        name: 'Juan Cruz',
        age: 50,
        sex: 'male',
        diagnosis: ' Fracture ',
        condition: { name: 'Serious injuries' },
      },
    ],
    missing_persons: [{ id: 'mp-unknown', name: '', age: null, sex: null }],
  }),
  report('r-pg-nursing', '09:12', 'c-pg', {
    unit_id: 'u-nursing',
    unit: { name: 'College of Nursing' },
    population_counts: [
      { count: 30, category: STUDENTS },
      { count: 5, category: FACULTY },
    ],
    damage_conditions: { name: 'Minor damage — cosmetic only' },
    casualties: [
      {
        id: 'cas-anon',
        name: '',
        age: null,
        sex: null,
        diagnosis: null,
        condition: { name: 'Minor injuries' },
      },
    ],
    missing_persons: [{ id: 'mp-maria', name: 'Maria Santos', age: 34, sex: 'female' }],
  }),
  report('r-pg-dentistry', '09:20', 'c-pg', {
    unit_id: 'u-dentistry',
    unit: { name: 'College of Dentistry' },
  }),
]);

describe('buildSummary', () => {
  const summary = buildSummary(DRILL, LISTS);

  it('reads a completed event as of its end', () => {
    expect(summary.completed).toBe(true);
    expect(summary.start).toEqual(at('09:00'));
    expect(summary.asOf).toEqual(at('11:00'));
  });

  it('counts the totals', () => {
    expect(summary.totals).toEqual({
      people: 45,
      reports: 3,
      casualties: 2,
      missing: 2,
      serious: 1,
      unidentified: 1,
      clustersCounted: 2,
    });
  });

  it('lists clusters in the order they first reported, and the ones still pending', () => {
    expect(summary.clusters.done.map((c) => [c.name, c.reports, c.people])).toEqual([
      ['Padre Faura', 1, 10],
      ['Pedro Gil', 2, 35],
    ]);
    expect(summary.clusters.done[1].units).toEqual([
      { name: 'College of Nursing', people: 35 },
      { name: 'College of Dentistry', people: 0 },
    ]);
    expect(summary.clusters.pending).toEqual([{ id: 'c-taft', name: 'Taft' }]);
    expect(summary.clusters).toMatchObject({ total: 3, reported: 2 });
  });

  it('adds up the headcount per field, largest first', () => {
    expect(summary.headcount).toEqual({
      rows: [
        { ...STUDENTS, count: 40 },
        { ...FACULTY, count: 5 },
      ],
      fieldsTotal: 2,
    });
  });

  it('puts the most serious casualties first', () => {
    expect(
      summary.casualties.map(({ name, who, condition, diagnosis, unit }) => ({
        name,
        who,
        condition,
        diagnosis,
        unit,
      }))
    ).toEqual([
      {
        name: 'Juan Cruz',
        who: 'Male · 50 yrs',
        condition: 'Serious injuries',
        diagnosis: 'Fracture',
        unit: 'No unit',
      },
      {
        name: 'Unknown person',
        who: 'No details',
        condition: 'Minor injuries',
        diagnosis: null,
        unit: 'College of Nursing',
      },
    ]);
    expect(summary.casualtiesByCondition.map((c) => [c.name, c.count])).toEqual([
      ['Minor injuries', 1],
      ['Serious injuries', 1],
      ['Fatality', 0],
    ]);
  });

  it('marks missing persons without a name as unidentified', () => {
    expect(summary.missing.map((m) => [m.name, m.identified, m.reportedBy])).toEqual([
      ['Unknown person', false, 'Ana Reyes'],
      ['Maria Santos', true, 'Ana Reyes'],
    ]);
  });

  it('times each cluster from the start to its first report', () => {
    expect(summary.firstReport).toEqual([
      { id: 'c-pf', name: 'Padre Faura', minutes: 5 },
      { id: 'c-pg', name: 'Pedro Gil', minutes: 12 },
      { id: 'c-taft', name: 'Taft', minutes: null },
    ]);
  });

  it('lists only units with damage, worst first', () => {
    expect(summary.damage.withDamage.map((d) => [d.unit, d.condition])).toEqual([
      ['College of Nursing', 'Minor damage — cosmetic only'],
    ]);
    expect(summary.damage.byCondition.map((d) => [d.name, d.count])).toEqual([
      ['No visible damage', 1],
      ['Minor damage — cosmetic only', 1],
      ['Major structural damage', 0],
    ]);
  });

  it('reads an ongoing event as of now and starts it at its first report without a start time', () => {
    const now = at('10:00');
    const ongoing = buildSummary(
      {
        ...DRILL,
        event: { ...DRILL.event, status: { name: 'Ongoing' }, started_at: null, ended_at: null },
      },
      LISTS,
      now
    );
    expect(ongoing.completed).toBe(false);
    expect(ongoing.asOf).toBe(now);
    expect(ongoing.start).toEqual(at('09:05'));
  });
});

describe('timeline', () => {
  const summary = buildSummary(DRILL, LISTS);
  const scale = timelineScale([summary]);

  it('uses 10-minute bars, at least six of them, for a short drill', () => {
    expect(scale).toEqual({ binMinutes: 10, bins: 6 });
    expect(timelineOf(summary, scale)).toEqual([1, 1, 1, 0, 0, 0]);
    expect(timelineLabels(summary, scale)).toEqual([
      '9:00',
      '9:10',
      '9:20',
      '9:30',
      '9:40',
      '9:50',
    ]);
  });

  it('widens the bars to fit a long event in twelve', () => {
    const long = buildSummary(
      source([report('r-1', '09:05', 'c-pf'), report('r-2', '15:00', 'c-pg')]),
      LISTS
    );
    expect(timelineScale([long])).toEqual({ binMinutes: 60, bins: 7 });
  });

  it('marks the first, halfway and last report', () => {
    expect(timelineMilestones(summary)).toEqual({
      first: '9:05 AM',
      half: '9:12 AM',
      last: '9:20 AM',
    });
  });

  it('keeps the first-report axis at an hour or more', () => {
    expect(firstReportScale([summary])).toBe(60);
  });
});

describe('compareSummaries', () => {
  const thisDrill = buildSummary(DRILL, LISTS);
  const lastDrill = buildSummary(source([report('r-old', '09:30', 'c-pg')]), LISTS);
  const rows = compareSummaries(thisDrill, lastDrill);
  const row = (measure: string) => rows.find((r) => r.measure === measure);

  it('reads more clusters reporting, sooner, as better', () => {
    expect(row('Clusters reported')).toMatchObject({
      a: '2 of 3',
      b: '1 of 3',
      change: '1 more',
      tone: 'good',
    });
    expect(row('First report')).toMatchObject({
      a: '9:05 AM',
      b: '9:30 AM',
      change: '25 min earlier',
      tone: 'good',
    });
    expect(row('Median time to first report')).toMatchObject({
      a: '9 min',
      b: '30 min',
      change: '21 min faster',
      tone: 'good',
    });
  });

  it('names the clusters that never reported', () => {
    expect(row('All clusters reported by')).toMatchObject({
      a: 'Not reached',
      change: 'Taft missing',
      tone: 'bad',
    });
  });

  it('reads more casualties as worse and report counts as neutral', () => {
    expect(row('Casualties')).toMatchObject({ change: '2 more', tone: 'bad' });
    expect(row('Reports')).toMatchObject({ change: '2 more', tone: 'same' });
  });
});
