import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import PizZip from 'pizzip';
import { headcountChart } from './headcount-chart';
import {
  breakdownLayout,
  breakdownTableXml,
  categoryChartXml,
  fillNsedTemplate,
} from './nsed-docx';
import { buildNsedReport, isUpManila, nsedFileName, properName, quarterOf } from './nsed-report';
import { scopeSource, type SummarySource } from './summary';

// The NSED report (DRRM-019): what the app fills into the UP Manila office's Word template, and
// that the template in public/ takes it.

type Report = SummarySource['reports'][number];

const at = (h: number, m: number) => new Date(2026, 2, 12, h, m);
const FIELDS = [
  { id: 'fac', name: 'Faculty Members' },
  { id: 'stu', name: 'Students' },
];
const CLUSTERS = [
  { id: 'pgh', name: 'PGH', units: [] },
  { id: 'taft', name: 'Taft', units: [] },
  { id: 'pf', name: 'Padre Faura', units: [] },
  { id: 'pg', name: 'Pedro Gil', units: [] },
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
      missing_persons: [person('RUSSELL RODRIGUEZ'), person('edsel salonga')],
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
  assert.equal(
    taft.breakdowns.find((b) => b.title === 'Taft Cluster')?.table.rows[0].unit,
    'No unit'
  );
});

test('the headcount summary has a row per cluster and a total, with structural damage', () => {
  const data = buildNsedReport(drill());
  assert.deepEqual(
    data.clusters.map((c) => [c.name, c.units, c.headcount, c.missing, c.casualties, c.damage]),
    [
      ['Pedro Gil', '3', '1,864', '3', '0', 'None reported'],
      ['Padre Faura', '0', '0', '0', '0', 'None reported'],
      ['Taft', '0', '0', '0', '0', 'None reported'],
      ['PGH', '2', '376', '0', '3', 'PGH Zone 2 (minor damage)'],
    ]
  );
  assert.deepEqual(
    [
      data.totalUnits,
      data.totalHeadcount,
      data.totalMissing,
      data.totalCasualties,
      data.totalDamage,
    ],
    ['5', '2,240', '3', '3', '1 area']
  );
});

test('each breakdown totals its units by field, then missing and casualties', () => {
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
  // Units in the order they first reported; PGH zones by zone number.
  assert.deepEqual(data.breakdowns[0].table, {
    unitHeader: 'College/Unit (Pedro Gil)',
    columns: ['Faculty', 'Students', 'Missing', 'Casualty'],
    rows: [
      { unit: 'Newborn Screening Reference Center', counts: ['10', '1,500', '0', '0'] },
      { unit: 'National Institutes of Health', counts: ['40', '302', '2', '0'] },
      { unit: 'UP Manila Phi House Dormitory', counts: ['0', '12', '1', '0'] },
    ],
    totals: ['50', '1,814', '3', '0'],
  });
  assert.deepEqual(
    data.breakdowns[3].table.rows.map((r) => [r.unit, ...r.counts]),
    [
      ['Zone 2', '0', '176', '0', '0'],
      ['Zone 10', '0', '200', '0', '3'],
    ]
  );
  assert.deepEqual(data.breakdowns[3].table.totals, ['0', '376', '0', '3']);
});

const UPM_COLUMNS = [
  'Faculty',
  'Admin',
  'REPS',
  'RA',
  'Students',
  'Philcare',
  'Security',
  'Construction W.',
  'Tenants',
  'Health W.',
  'Non-academic staff',
  'Visitors/Patients',
  'Missing',
  'Casualty',
];

test("a breakdown with UP Manila's 12 fields fits 0.25 in from the paper's edges, headers 8 pt", () => {
  const table = {
    unitHeader: 'College/Unit (Pedro Gil)',
    columns: UPM_COLUMNS,
    rows: [{ unit: 'College of Allied Medical Professions', counts: UPM_COLUMNS.map(() => '249') }],
    totals: UPM_COLUMNS.map((_, i) => (i === 4 ? '1,592' : '99')),
  };
  const layout = breakdownLayout(table);
  assert.equal(layout.headerSize, 8);
  assert.ok(layout.unitWidth >= 1400);
  // A4 (11920 twips) less 0.25 in (360) on each side.
  assert.equal(layout.unitWidth + layout.numberWidths.reduce((sum, w) => sum + w, 0), 11200);
  // "Construction" is the longest word, so its column is the widest.
  assert.equal(Math.max(...layout.numberWidths), layout.numberWidths[7]);

  const xml = breakdownTableXml(table);
  assert.match(xml, /<w:tblW w:w="11200" w:type="dxa"\/><w:tblInd w:w="-1080" w:type="dxa"\/>/);
  assert.doesNotMatch(xml, /textDirection/, 'headers run left to right');
  assert.match(
    xml,
    /<w:sz w:val="16"\/><w:szCs w:val="16"\/><\/w:rPr><w:t xml:space="preserve">Faculty</
  );
  assert.match(
    xml,
    /<w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t xml:space="preserve">1,592</
  );
  assert.match(xml, /Visitors\/\u200BPatients/, 'may wrap after the slash');
});

test('more fields than fit: the smallest header size, and the unit column keeps its room', () => {
  const columns = [...UPM_COLUMNS.slice(0, -2), 'Contractors', 'Volunteers', 'Missing', 'Casualty'];
  const layout = breakdownLayout({
    unitHeader: 'College/Unit (Taft)',
    columns,
    rows: [],
    totals: columns.map(() => '0'),
  });
  assert.equal(layout.headerSize, 7);
  assert.equal(layout.unitWidth, 1400);
});

test('two reports from one unit make one row', () => {
  const data = buildNsedReport(
    source([
      report('taft', 'CAS', at(15, 40), [2, 10]),
      report('taft', 'CAS', at(15, 44), [1, 5], { missing_persons: [person('')] }),
    ])
  );
  assert.deepEqual(data.breakdowns[2].table.rows, [{ unit: 'CAS', counts: ['3', '15', '1', '0'] }]);
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

test('names are written with a capital first letter, whatever case they were typed in', () => {
  assert.equal(properName('JUAN DELA CRUZ'), 'Juan Dela Cruz');
  assert.equal(properName('  maria   santos '), 'Maria Santos');
  assert.equal(properName("o'neil-smith jr."), "O'Neil-Smith Jr.");
  assert.equal(properName('JOSE RIZAL III'), 'Jose Rizal III');
});

test('the headcount chart on the summary: units grouped by cluster, series with totals', () => {
  const chart = headcountChart(drill());
  assert.deepEqual(
    chart.clusters.map((c) => [c.name, c.units.map((u) => [u.name, u.values, u.total])]),
    [
      [
        'Pedro Gil',
        [
          ['Newborn Screening Reference Center', [10, 1500, 0, 0], 1510],
          ['National Institutes of Health', [40, 302, 2, 0], 344],
          ['UP Manila Phi House Dormitory', [0, 12, 1, 0], 13],
        ],
      ],
      [
        'PGH',
        [
          ['Zone 2', [0, 176, 0, 0], 176],
          ['Zone 10', [0, 200, 0, 3], 203],
        ],
      ],
    ],
    'clusters with no report are left out'
  );
  assert.deepEqual(
    chart.series.map((s) => [s.name, s.total]),
    [
      ['Faculty', 50],
      ['Students', 2190],
      ['Missing', 3],
      ['Casualty', 3],
    ]
  );

  // A cluster's page shows that cluster's units only; an event with no reports, no bars.
  const pgh = headcountChart(scopeSource(drill(), { clusterId: 'pgh', unitId: null }));
  assert.deepEqual(
    pgh.clusters.map((c) => c.name),
    ['PGH']
  );
  assert.deepEqual(
    pgh.series.map((s) => s.total),
    [0, 376, 0, 3]
  );
  assert.deepEqual(headcountChart(source([])).clusters, []);
});

test('the chart: a bar per unit, a stacked series per field, then missing and casualties', () => {
  const { chart } = buildNsedReport(drill());
  assert.deepEqual(chart.units, [
    'Newborn Screening Reference Center',
    'National Institutes of Health',
    'UP Manila Phi House Dormitory',
    'Zone 2',
    'Zone 10',
  ]);
  assert.deepEqual(
    chart.series.map((s) => [s.name, s.color, s.values]),
    [
      ['Faculty', '1A5E80', [10, 40, 0, 0, 0]],
      ['Students', '9C2A91', [1500, 302, 12, 176, 200]],
      ['Missing', 'A4C2D2', [0, 2, 1, 0, 0]],
      ['Casualty', 'F6C8AB', [0, 0, 0, 0, 3]],
    ]
  );
  assert.deepEqual(chart.totals, [1510, 344, 13, 176, 203]);

  const xml = categoryChartXml(chart);
  assert.match(xml, /<c:barDir val="bar"\/><c:grouping val="stacked"\/>/);
  assert.match(xml, /<c:orientation val="maxMin"\/>/, 'first unit on top');
  assert.match(xml, /<c:legendPos val="r"\/>/);
  assert.match(xml, /<a:t>1,510<\/a:t>/, 'totals at the bar ends');
  assert.match(
    xml,
    /<c:legendEntry><c:idx val="4"\/><c:delete val="1"\/>/,
    'no Total in the legend'
  );
});

test('the template in public/ fills without leftover tags', () => {
  const template = readFileSync('public/templates/nsed-report.docx');
  const zip = new PizZip(fillNsedTemplate(template, buildNsedReport(drill())));
  const xml = zip.file('word/document.xml')!.asText();
  const text = xml.replace(/<[^>]+>/g, '');

  assert.doesNotMatch(text, /[{}]/, 'every tag is filled');
  assert.match(text, /1ST QUARTER NATIONWIDE SIMULTANEOUS EARTHQUAKE DRILL/);
  assert.match(text, /Executive Summary\[Add the executive summary\]/);
  assert.doesNotMatch(text, /actively participated/, 'the office writes the summary');
  assert.match(text, /Observer NameArea\/ BuildingComment\/s\[…\]/);
  assert.match(text, /Structural damage/);
  assert.match(text, /PGH Zone 2 \(minor damage\)/);
  assert.match(text, /Breakdown: Pedro Gil Cluster/);
  assert.match(text, /College\/Unit \(Pedro Gil\)FacultyStudentsMissingCasualty/);
  assert.match(text, /No reports were received from this cluster\./);
  assert.match(text, /Total \(PGH\): 376/);
  assert.match(text, /Total Headcount \(reported to IC\)Total Headcount \(reported via IRS\)/);
  assert.match(text, /Pedro Gil\[…\]1,864\[…\]3\[…\]0/);
  // The office's blanks stay highlighted, and long tables repeat their header row.
  assert.match(
    xml,
    /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">\[Add the executive summary\]/
  );
  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
  assert.equal(tables.length, 9);
  for (const t of tables.filter((t) => /Headcount|Time|Casualty|Observer/.test(t))) {
    assert.match(t, /<w:tblHeader\/>/);
  }
  // Timeline: College/Building and Time centred.
  assert.match(
    tables[0],
    /<w:jc w:val="center"\/><\/w:pPr><w:r><w:rPr><w:b\/><w:bCs\/><\/w:rPr><w:t xml:space="preserve">College\/Building/
  );
  // The chart, its part, relationship and content type.
  assert.match(xml, /<c:chart r:id="rIdNsedChart1"\/>/);
  assert.ok(zip.file('word/charts/chart1.xml'));
  assert.deepEqual(
    Object.keys(zip.files).filter((name) => name.endsWith('/')),
    [],
    'no folder entries'
  );
  assert.match(zip.file('word/_rels/document.xml.rels')!.asText(), /Target="charts\/chart1.xml"/);
  assert.match(zip.file('[Content_Types].xml')!.asText(), /PartName="\/word\/charts\/chart1.xml"/);
  // Table text is 12 pt.
  assert.match(
    zip.file('word/styles.xml')!.asText(),
    /w:styleId="NsedTableText"[\s\S]*?<w:sz w:val="24"\/>/
  );
});

test('an event with no reports fills without a chart', () => {
  const template = readFileSync('public/templates/nsed-report.docx');
  const zip = new PizZip(fillNsedTemplate(template, buildNsedReport(source([]))));
  const text = zip
    .file('word/document.xml')!
    .asText()
    .replace(/<[^>]+>/g, '');
  assert.doesNotMatch(text, /[{}]/);
  assert.match(text, /No reports were received\./);
  assert.equal(zip.file('word/charts/chart1.xml'), null);
});
