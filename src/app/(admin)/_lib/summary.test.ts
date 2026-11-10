import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSummary,
  NO_UNIT,
  reportPlace,
  reportTimeline,
  resolveScope,
  scopedCoverage,
  scopeHref,
  scopeSource,
  type SummarySource,
} from './summary';

// Narrowing the event summary to a cluster or unit (DRRM-024), and which units haven't reported.

type Report = SummarySource['reports'][number];

const LISTS = { casualtyConditions: [], damageConditions: [] };
const FIELD = { id: 'f1', name: 'Students' };
const BEFORE = new Date(2026, 2, 1);
const START = new Date(2026, 2, 12, 9, 0);
const END = new Date(2026, 2, 12, 10, 0);
const AFTER = new Date(2026, 2, 20);

const unit = (id: string, name: string, created_at = BEFORE) => ({ id, name, created_at });

const CLUSTERS = [
  {
    id: 'pg',
    name: 'Pedro Gil',
    units: [unit('cams', 'Allied Medical'), unit('med', 'Medicine'), unit('nur', 'Nursing')],
  },
  { id: 'taft', name: 'Taft', units: [unit('cph', 'Public Health')] },
  { id: 'shs', name: 'SHS', units: [] },
];

const UNIT_NAMES: Record<string, string> = {
  cams: 'Allied Medical',
  med: 'Medicine',
  nur: 'Nursing',
  cph: 'Public Health',
  old: 'Old Building',
};

let n = 0;
function report(
  clusterId: string,
  unitId: string | null,
  people: number,
  extra: Partial<Report> = {}
): Report {
  n++;
  return {
    id: `r${n}`,
    submitted_at: new Date(2026, 2, 12, 9, n),
    cluster_id: clusterId,
    unit_id: unitId,
    cluster: { name: CLUSTERS.find((c) => c.id === clusterId)?.name ?? 'Closed cluster' },
    unit: unitId ? { name: UNIT_NAMES[unitId] ?? unitId } : null,
    user: { first_name: 'Member', last_name: String(n) },
    damage_conditions: null,
    population_counts: [{ count: people, category: FIELD }],
    casualties: [],
    missing_persons: [],
    ...extra,
  };
}

function source(reports: Report[], event: Partial<SummarySource['event']> = {}): SummarySource {
  return {
    event: {
      id: 'e1',
      name: 'Q1 drill',
      description: null,
      quarter: 'Q1 2026',
      started_at: START,
      ended_at: null,
      campus_id: 'upm',
      campus: { name: 'UP Manila' },
      status: { name: 'Ongoing' },
      completer: null,
      ...event,
    },
    reports,
    clusters: CLUSTERS,
    fields: [FIELD],
  };
}

const drill = () =>
  source([
    report('pg', 'med', 310),
    report('pg', 'med', 187),
    report('pg', 'cams', 130),
    report('pg', null, 5),
    report('taft', null, 7),
  ]);

const rowOf = (s: SummarySource, id: string) =>
  buildSummary(s, LISTS).clusters.done.find((c) => c.id === id)!;

test('adds several reports from one unit', () => {
  assert.equal(rowOf(drill(), 'pg').units.find((u) => u.id === 'med')?.people, 497);
});

test('units add up to clusters and clusters to the event', () => {
  const summary = buildSummary(drill(), LISTS);
  for (const row of summary.clusters.done) {
    assert.equal(
      row.units.reduce((sum, u) => sum + u.people, 0),
      row.people
    );
  }
  assert.equal(
    summary.clusters.done.reduce((sum, c) => sum + c.people, 0),
    summary.totals.people
  );
  assert.equal(summary.totals.people, 639);
});

test('scopes to a cluster', () => {
  const summary = buildSummary(scopeSource(drill(), { clusterId: 'pg', unitId: null }), LISTS);
  assert.equal(summary.totals.reports, 4);
  assert.equal(summary.totals.people, 632);
  assert.equal(summary.clusters.total, 1);
});

test('scopes to a unit', () => {
  const summary = buildSummary(scopeSource(drill(), { clusterId: 'pg', unitId: 'med' }), LISTS);
  assert.equal(summary.totals.reports, 2);
  assert.equal(summary.totals.people, 497);
});

test('no unit stays inside its cluster', () => {
  const scoped = scopeSource(drill(), { clusterId: 'pg', unitId: NO_UNIT });
  assert.equal(scoped.reports.length, 1);
  assert.equal(scoped.reports[0].cluster_id, 'pg');
  assert.equal(scoped.reports[0].unit_id, null);
});

test('coverage counts active units', () => {
  assert.deepEqual(rowOf(drill(), 'pg').coverage, {
    total: 3,
    reported: 2,
    missing: [{ id: 'nur', name: 'Nursing' }],
  });
});

test('coverage counts a report of zero people', () => {
  const coverage = rowOf(source([report('pg', 'nur', 0)]), 'pg').coverage;
  assert.equal(coverage?.reported, 1);
  assert.ok(!coverage?.missing.some((u) => u.id === 'nur'));
});

test('coverage ignores no unit and deactivated units', () => {
  const s = source([report('pg', 'med', 10), report('pg', null, 5), report('pg', 'old', 20)]);
  assert.equal(rowOf(s, 'pg').coverage?.reported, 1);
  assert.equal(rowOf(s, 'pg').coverage?.total, 3);
  assert.equal(buildSummary(s, LISTS).totals.people, 35);
});

test('coverage is null without expected units', () => {
  const s = source([report('shs', null, 1), report('closed', null, 2)]);
  assert.equal(rowOf(s, 'shs').coverage, null);
  assert.equal(rowOf(s, 'closed').coverage, null);
});

test('pending clusters list all units', () => {
  const taft = buildSummary(source([]), LISTS).clusters.pending.find((c) => c.id === 'taft');
  assert.deepEqual(taft?.coverage, {
    total: 1,
    reported: 0,
    missing: [{ id: 'cph', name: 'Public Health' }],
  });
});

test('units added after a completed event are not expected', () => {
  const late = {
    ...CLUSTERS[1],
    units: [unit('cph', 'Public Health'), unit('new', 'New Unit', AFTER)],
  };
  const withLate = (event: Partial<SummarySource['event']>) => ({
    ...source([report('taft', 'cph', 1)], event),
    clusters: [late],
  });
  const completed = { status: { name: 'Completed' }, ended_at: END };
  assert.equal(rowOf(withLate(completed), 'taft').coverage?.total, 1);
  assert.equal(rowOf(withLate({}), 'taft').coverage?.total, 2);
  assert.equal(rowOf(withLate({ ...completed, ended_at: null }), 'taft').coverage?.total, 2);
});

test('resolves a valid scope', () => {
  assert.deepEqual(resolveScope(drill(), { cluster: 'pg', unit: 'med' }), {
    scope: { clusterId: 'pg', clusterName: 'Pedro Gil', unitId: 'med', unitName: 'Medicine' },
    invalid: false,
  });
  assert.deepEqual(resolveScope(drill(), { cluster: 'pg', unit: NO_UNIT }), {
    scope: { clusterId: 'pg', clusterName: 'Pedro Gil', unitId: NO_UNIT, unitName: 'No unit' },
    invalid: false,
  });
  assert.deepEqual(resolveScope(drill(), { cluster: null, unit: null }), {
    scope: null,
    invalid: false,
  });
});

test('falls back on a bad link', () => {
  const bad = { scope: null, invalid: true };
  assert.deepEqual(resolveScope(drill(), { cluster: 'nope', unit: null }), bad);
  assert.deepEqual(resolveScope(drill(), { cluster: null, unit: 'med' }), bad);
  assert.deepEqual(resolveScope(drill(), { cluster: 'taft', unit: 'med' }), bad);
  assert.deepEqual(resolveScope(source([]), { cluster: 'pg', unit: NO_UNIT }), bad);
});

test('accepts a real unit or cluster with no reports', () => {
  const s = drill();
  const unitScope = resolveScope(s, { cluster: 'pg', unit: 'nur' }).scope!;
  assert.equal(unitScope.unitName, 'Nursing');
  assert.equal(buildSummary(scopeSource(s, unitScope), LISTS).totals.people, 0);

  const empty = source([]);
  const clusterScope = resolveScope(empty, { cluster: 'taft', unit: null }).scope!;
  assert.equal(clusterScope.clusterName, 'Taft');
  const summary = buildSummary(scopeSource(empty, clusterScope), LISTS);
  assert.equal(summary.totals.people, 0);
  assert.equal(scopedCoverage(summary)?.missing[0].id, 'cph');
});

test('accepts inactive clusters and deactivated units with reports', () => {
  const s = source([report('closed', null, 2), report('pg', 'old', 20)]);
  assert.equal(
    resolveScope(s, { cluster: 'closed', unit: null }).scope?.clusterName,
    'Closed cluster'
  );
  assert.equal(resolveScope(s, { cluster: 'pg', unit: 'old' }).scope?.unitName, 'Old Building');
});

test('scoped coverage reads the narrowed cluster', () => {
  const summary = buildSummary(scopeSource(drill(), { clusterId: 'pg', unitId: null }), LISTS);
  assert.equal(scopedCoverage(summary)?.total, 3);
});

test('builds scope links', () => {
  const params = new URLSearchParams('id=e1&cluster=pg&unit=med');
  const path = '/events/details';
  assert.equal(scopeHref(path, params, { clusterId: 'pg' }), `${path}?id=e1&cluster=pg`);
  assert.equal(scopeHref(path, params, { clusterId: null }), `${path}?id=e1`);
  assert.equal(
    scopeHref(path, params, { clusterId: 'taft', unitId: 'cph' }),
    `${path}?id=e1&cluster=taft&unit=cph`
  );
  assert.equal(
    scopeHref(
      '/campus/details',
      new URLSearchParams('id=c1'),
      { clusterId: 'pg' },
      { event: 'e2' }
    ),
    '/campus/details?id=c1&event=e2&cluster=pg'
  );
});

test('the timeline of reports: who, from where and when, first report first', () => {
  const at = (h: number, m: number) => new Date(2026, 2, 12, h, m);
  const who = (first_name: string, last_name: string) => ({ first_name, last_name });
  const rows = reportTimeline([
    report('taft', 'cph', 4, { submitted_at: at(9, 41), user: who('Ana', 'Cruz') }),
    report('pg', 'med', 310, { submitted_at: at(9, 32), user: who('Ben', 'Reyes') }),
    report('pg', null, 5, { submitted_at: at(9, 35), user: who('Cora', 'Lim') }),
    report('pg', 'z1', 9, { submitted_at: at(9, 30), unit: { name: 'Zone 1' }, user: null }),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.name, r.place, r.at.getMinutes()]),
    [
      ['—', 'Pedro Gil Zone 1', 30],
      ['Ben Reyes', 'Medicine', 32],
      ['Cora Lim', 'Pedro Gil cluster', 35],
      ['Ana Cruz', 'Public Health', 41],
    ]
  );
});

test('the timeline follows a cluster scope', () => {
  const rows = reportTimeline(scopeSource(drill(), { clusterId: 'taft', unitId: null }).reports);
  assert.deepEqual(
    rows.map((r) => r.place),
    ['Taft cluster']
  );
  assert.equal(
    reportPlace({ cluster: { name: 'PGH' }, unit: { name: ' Zone 10 ' } }),
    'PGH Zone 10'
  );
});
