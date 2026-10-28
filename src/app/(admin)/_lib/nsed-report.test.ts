import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import PizZip from 'pizzip';
import { fillNsedTemplate } from './nsed-docx';
import { buildNsedReport, isUpManila, nsedFileName, quarterOf } from './nsed-report';
import type { SummarySource } from './summary';

// The NSED report (DRRM-019): what the app fills into the UP Manila office's Word template, and
// that the template in public/ takes it.

type Report = SummarySource['reports'][number];

const at = (h: number, m: number) => new Date(2026, 2, 12, h, m);
const FIELDS = [
  { id: 'fac', name: 'Faculty Members' },
  { id: 'stu', name: 'Students' },
];
const CLUSTERS = [
  { id: 'pgh', name: 'PGH' },
  { id: 'taft', name: 'Taft' },
  { id: 'pf', name: 'Padre Faura' },
  { id: 'pg', name: 'Pedro Gil' },
];

let n = 0;
function report(
  cluster: string,
  unit: string | null,
  time: Date,
  counts: [faculty: number, students: number],
  extra: Partial<Report> = {}
): Report {
  n++;
  return {
    id: `r${n}`,
    submitted_at: time,
    cluster_id: cluster,
    unit_id: unit && `u-${unit}`,
    cluster: { name: CLUSTERS.find((c) => c.id === cluster)!.name },
    unit: unit ? { name: unit } : null,
    user: { first_name: 'Member', last_name: String(n) },
    damage_conditions: { name: 'No visible damage' },
    population_counts: [
      { count: counts[0], category: FIELDS[0] },
      { count: counts[1], category: FIELDS[1] },
    ],
    casualties: [],
    missing_persons: [],
    ...extra,
  };
}

const person = (name: string) => ({ id: name || 'x', name, age: null, sex: null });
const casualty = (condition: string) => ({
  id: condition,
  name: '',
  age: null,
  sex: null,
  diagnosis: null,
  condition: { name: condition },
});

function source(reports: Report[], event: Partial<SummarySource['event']> = {}): SummarySource {
  return {
    event: {
      id: 'e1',
      name: 'Q1 2026 NSED',
      description: null,
      quarter: 'Q1 2026',
      started_at: at(15, 30),
      ended_at: at(15, 52),
      campus_id: 'upm',
      campus: { name: 'UP Manila' },
      status: { name: 'Completed' },
      completer: null,
      ...event,
    },
    reports,
    clusters: CLUSTERS,
    fields: FIELDS,
  };
}

const drill = () =>
  source([
    report('pgh', 'Zone 10', at(15, 36), [0, 200], {
      casualties: [
        casualty('Minor injuries — no hospitalization needed'),
        casualty('Minor injuries — no hospitalization needed'),
        casualty('Serious injuries — requires hospitalization'),
      ],
    }),
    report('pg', 'National Institutes of Health', at(15, 39), [40, 302], {
      missing_persons: [person('Russell Rodriguez'), person('Edsel Salonga')],
    }),
    report('pgh', 'Zone 2', at(15, 37), [0, 176], {
      damage_conditions: { name: 'Minor damage — cosmetic only' },
    }),
    report('pg', 'Newborn Screening Reference Center', at(15, 35), [10, 1500]),
    report('pg', 'UP Manila Phi House Dormitory', at(15, 46), [0, 12], {
      missing_persons: [person('')],
    }),
  ]);

test('only UP Manila events offer the report', () => {
  assert.equal(isUpManila('UP Manila'), true);
  assert.equal(isUpManila(' University of the Philippines Manila '), true);
  assert.equal(isUpManila('UP Diliman'), false);
  assert.equal(isUpManila('UP PGH'), false);
});

test('the quarter comes from the Quarter field, then the name, then the start date', () => {
  const event = source([]).event;
  assert.deepEqual(quarterOf(event, at(15, 30)), { quarter: 1, year: '2026' });
  assert.deepEqual(quarterOf({ ...event, quarter: null, name: 'Q3 2025 NSED' }, null), {
    quarter: 3,
    year: '2025',
  });
  assert.deepEqual(
    quarterOf({ ...event, quarter: null, name: 'Fire drill' }, new Date(2026, 10, 4)),
    {
      quarter: 4,
      year: '2026',
    }
  );
  assert.equal(nsedFileName(source([])), 'NSED Report Q1 2026.docx');
});

test('the introduction: date, times and headcount per cluster in the office order', () => {
  const data = buildNsedReport(drill());
  assert.equal(data.quarterOrdinalUpper, '1ST');
  assert.equal(data.quarterOrdinal, '1st');
  assert.equal(data.drillDate, 'March 12, 2026');
  assert.equal(data.drillWeekday, 'Thursday');
  assert.equal(data.startTime, '3:30 PM');
  assert.equal(data.standDownTime, '3:52 PM');
  assert.equal(data.firstReportTime, '3:35 PM');
  assert.equal(
    data.clusterHeadcounts,
    '1,864 from the Pedro Gil cluster, no report from the Padre Faura cluster, no report from the Taft cluster, and 376 from the PGH cluster'
  );
  assert.equal(data.totalHeadcount, '2,240');
});

test('the timeline is in time order and names zones and unit-less reports by cluster', () => {
  const data = buildNsedReport(drill());
  assert.deepEqual(
    data.timeline.map((t) => [t.place, t.time]),
    [
      ['Newborn Screening Reference Center', '3:35 PM'],
      ['PGH Zone 10', '3:36 PM'],
      ['PGH Zone 2', '3:37 PM'],
      ['National Institutes of Health', '3:39 PM'],
      ['UP Manila Phi House Dormitory', '3:46 PM'],
    ]
  );
  const taft = buildNsedReport(source([report('taft', null, at(15, 42), [0, 28])]));
  assert.equal(taft.timeline[0].place, 'Taft cluster');
  assert.equal(taft.breakdowns.find((b) => b.title === 'Taft Cluster')?.rows[0].unit, 'No unit');
});

test('the headcount summary has a row per cluster and a total', () => {
  const data = buildNsedReport(drill());
  assert.deepEqual(
    data.clusters.map((c) => [c.name, c.units, c.headcount, c.missing, c.casualties]),
    [
      ['Pedro Gil', '3', '1,864', '3', '0'],
      ['Padre Faura', '0', '0', '0', '0'],
      ['Taft', '0', '0', '0', '0'],
      ['PGH', '2', '376', '0', '3'],
    ]
  );
  assert.deepEqual(
    [data.totalUnits, data.totalHeadcount, data.totalMissing, data.totalCasualties],
    ['5', '2,240', '3', '3']
  );
});

test('each cluster gets a breakdown; PGH zones are listed by zone number', () => {
  const data = buildNsedReport(drill());
  assert.deepEqual(
    data.breakdowns.map((b) => [b.title, b.hasReports, b.headcount]),
    [
      ['Pedro Gil Cluster', true, '1,864'],
      ['Padre Faura Cluster', false, '0'],
      ['Taft Cluster', false, '0'],
      ['PGH', true, '376'],
    ]
  );
  const pgh = data.breakdowns[3];
  assert.deepEqual(
    pgh.rows.map((r) => r.unit),
    ['Zone 2', 'Zone 10']
  );
  assert.deepEqual(
    data.breakdowns[0].rows.map((r) => r.time),
    ['3:35 PM', '3:39 PM', '3:46 PM']
  );
});

test('the note under each cluster: missing persons, casualties and damage', () => {
  const data = buildNsedReport(drill());
  assert.equal(
    data.breakdowns[0].note,
    'Russell Rodriguez and Edsel Salonga were reported missing at the National Institutes of Health. ' +
      'The UP Manila Phi House Dormitory reported one (1) missing person, but the name was not provided. ' +
      'No building damage was reported. '
  );
  assert.equal(
    data.breakdowns[3].note,
    'PGH Zone 10 reported 3 casualties: minor injuries (2) and serious injuries (1). ' +
      'Building damage was reported at PGH Zone 2 (minor damage). '
  );
  assert.equal(data.breakdowns[1].note, '');
});

test('headcount by category: the campus fields by cluster, with totals', () => {
  const { categories } = buildNsedReport(drill());
  assert.deepEqual(categories.clusters, ['Pedro Gil', 'Padre Faura', 'Taft', 'PGH']);
  assert.deepEqual(categories.rows, [
    { name: 'Faculty Members', counts: ['50', '0', '0', '0'], total: '50' },
    { name: 'Students', counts: ['1,814', '0', '0', '376'], total: '2,190' },
  ]);
  assert.deepEqual(categories.totals, ['1,864', '0', '0', '376']);
  assert.equal(categories.total, '2,240');
});

test('the template in public/ fills without leftover tags', () => {
  const template = readFileSync('public/templates/nsed-report.docx');
  const xml = new PizZip(fillNsedTemplate(template, buildNsedReport(drill())))
    .file('word/document.xml')!
    .asText();
  const text = xml.replace(/<[^>]+>/g, '');

  assert.doesNotMatch(text, /[{}]/, 'every tag is filled');
  assert.match(text, /1ST QUARTER NATIONWIDE SIMULTANEOUS EARTHQUAKE DRILL/);
  assert.match(text, /On March 12, 2026, at 3:30 PM/);
  assert.match(text, /Breakdown: Pedro Gil Cluster/);
  assert.match(text, /No reports were received from this cluster\./);
  assert.match(text, /Total \(PGH\): 376/);
  // The office's blanks stay highlighted, and long tables repeat their header row.
  assert.match(
    xml,
    /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">\[Incident Commander\]/
  );
  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
  const dataTables = tables.filter((t) => /Headcount|Time|Category/.test(t));
  assert.ok(dataTables.length >= 5);
  for (const t of dataTables) assert.match(t, /<w:tblHeader\/>/);
  // The category table has a column per cluster.
  assert.match(
    xml,
    /Category[\s\S]*?Pedro Gil[\s\S]*?Padre Faura[\s\S]*?Taft[\s\S]*?PGH[\s\S]*?Total/
  );
});
