import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import PizZip from 'pizzip';
import { buildNsedDilimanReport, clusterTableOf, nsedDilimanFileName } from './nsed-diliman';
import { clusterTableXml, fillNsedDilimanTemplate } from './nsed-docx';
import type { SummarySource } from './summary';

// The UP Diliman NSED report (DRRM-032): UPRI's report to the UP President, filled from the IRS.

type Report = SummarySource['reports'][number];

const at = (h: number, m: number) => new Date(2026, 10, 5, h, m);
const FIELDS = [
  { id: 'stu', name: 'Students' },
  { id: 'adm', name: 'Administrative Personnel' },
  { id: 'jo', name: 'JO/COS Personnel' },
  { id: 'reps', name: 'REPS' },
];
const CLUSTERS = [
  { id: 'cssp', name: 'College of Social Sciences and Philosophy', units: [] },
  { id: 'coe', name: 'College of Engineering', units: [] },
  { id: 'cmu', name: 'College of Music', units: [] },
  { id: 'sam', name: 'Sampaguita Residence Hall', units: [] },
  { id: 'cal', name: 'College of Arts and Letters', units: [] },
];

let n = 0;
function report(
  cluster: string,
  unit: string | null,
  time: Date,
  counts: number[],
  casualties: string[] = []
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
    population_counts: counts.map((count, i) => ({ count, category: FIELDS[i] })),
    casualties: casualties.map((condition, i) => ({
      id: `c${n}-${i}`,
      name: '',
      age: null,
      sex: null,
      diagnosis: null,
      condition: { name: condition },
    })),
    missing_persons: [],
  };
}

function source(reports: Report[]): SummarySource {
  return {
    event: {
      id: 'e1',
      name: 'NSED Q4 2026',
      description: null,
      quarter: 'Q4 2026',
      started_at: at(9, 0),
      ended_at: at(16, 33),
      campus_id: 'upd',
      campus: { name: 'UP Diliman' },
      status: { name: 'Completed' },
      completer: null,
    },
    reports,
    clusters: CLUSTERS,
    fields: FIELDS,
  };
}

const MODERATE = 'Moderate injuries — requires medical attention';
const MINOR = 'Minor injuries — no hospitalization needed';

const drill = () =>
  source([
    report('cssp', 'Office of the Dean', at(9, 22), [400, 40, 8, 0]),
    report('coe', 'Department of Industrial Engineering', at(9, 23), [20, 4, 0, 0]),
    report('cssp', 'Department of Psychology', at(9, 30), [90, 8, 0, 0]),
    report('cmu', 'Annex 108', at(9, 25), [100, 10, 10, 4], [MODERATE, MINOR, MODERATE]),
    report('sam', null, at(15, 59), [100, 4, 0, 0]),
    report('cssp', 'Office of the Dean', at(10, 5), [0, 0, 0, 0]),
  ]);

test('the table: clusters and units in the order they first reported, with a grand total', () => {
  const table = clusterTableOf(drill().reports);
  assert.deepEqual(
    table.clusters.map((c) => [
      c.name,
      c.reports,
      c.casualties,
      c.headcount,
      c.units.map((u) => [u.name, u.reports, u.headcount]),
    ]),
    [
      [
        'College of Social Sciences and Philosophy',
        3,
        0,
        546,
        [
          ['Office of the Dean', 2, 448],
          ['Department of Psychology', 1, 98],
        ],
      ],
      ['College of Engineering', 1, 0, 24, [['Department of Industrial Engineering', 1, 24]]],
      ['College of Music', 1, 3, 124, [['Annex 108', 1, 124]]],
      ['Sampaguita Residence Hall', 1, 0, 104, [['No unit specified', 1, 104]]],
    ]
  );
  assert.deepEqual(table.total, { reports: 6, casualties: 3, headcount: 798 });
});

test('the counts UPRI writes in its summary', () => {
  const data = buildNsedDilimanReport(drill());
  assert.equal(data.drillDate, 'November 5, 2026');
  assert.equal(data.quarterOrdinal, '4th');
  assert.equal(data.quarter, '4');
  assert.equal(data.year, '2026');
  assert.equal(data.startTime, '9:00 AM');
  assert.equal(data.reportCount, '6 reports');
  assert.equal(data.reportVerb, 'were');
  assert.equal(data.clusterCount, '4 out of 5 clusters');
  assert.equal(data.individuals, '798 individuals');
  assert.equal(
    data.categoryCounts,
    '710 students, 66 administrative personnel, 18 JO/COS personnel and 4 REPS'
  );
  assert.equal(data.casualtyCount, 'three victims');
  assert.equal(
    data.casualtyBreakdown,
    'two individuals with moderate injuries and one individual with minor injuries'
  );
  assert.equal(data.firstReportAfter, '22 minutes');
  assert.equal(data.lastReportAfter, '419 minutes');
  assert.equal(nsedDilimanFileName(drill()), 'NSED-2026-Q4-UP-Diliman-report.docx');
});

test('one report reads in the singular', () => {
  const data = buildNsedDilimanReport(source([report('coe', null, at(9, 1), [1, 0, 0, 0])]));
  assert.equal(data.reportCount, '1 report');
  assert.equal(data.reportVerb, 'was');
  assert.equal(data.individuals, '1 individual');
  assert.equal(data.firstReportAfter, '1 minute');
  assert.equal(data.hasCasualties, false);
});

test('the table XML: header row repeats, clusters merge down over their units', () => {
  const xml = clusterTableXml(clusterTableOf(drill().reports));
  const text = xml.replace(/<[^>]+>/g, '');
  assert.match(text, /^No\.ClusterCollege\/UnitReportsCasualtiesHeadcount/);
  assert.match(
    text,
    /1College of Social Sciences and PhilosophyCluster Total30546Office of the Dean20448/
  );
  assert.match(text, /GRAND TOTAL63798$/);
  assert.match(xml, /<w:tblHeader\/>/);
  assert.equal((xml.match(/<w:vMerge w:val="restart"\/>/g) ?? []).length, 8, 'No. and Cluster');
  assert.equal((xml.match(/<w:vMerge w:val="continue"\/>/g) ?? []).length, 10, 'one per unit');
  assert.match(xml, /<w:gridSpan w:val="3"\/>/);
});

test('the UP Diliman template in public/ fills without leftover tags or anyone’s name', () => {
  const template = readFileSync('public/templates/nsed-report-diliman.docx');
  const zip = new PizZip(fillNsedDilimanTemplate(template, buildNsedDilimanReport(drill())));
  const xml = zip.file('word/document.xml')!.asText();
  const text = xml.replace(/<[^>]+>/g, '');

  assert.doesNotMatch(text, /[{}]/, 'every tag is filled');
  // It starts at the title page: the cover letter to the President is left out.
  assert.match(text, /^\s*UP Diliman 4th Quarter Nationwide Simultaneous Earthquake Drill/);
  assert.doesNotMatch(text, /Dear President|Greetings!|Respectfully yours/);
  assert.match(text, /conducted on November 5, 2026, at 9:00 AM at the University/);
  assert.match(text, /a total of 6 reports were received from 4 out of 5 clusters, covering 798/);
  assert.match(text, /accounted for 710 students, 66 administrative personnel/);
  assert.match(text, /In all, 4 of the 5 Colleges\/Units/);
  assert.match(text, /recorded three victims, referred to as casualties, consisting of two/);
  assert.doesNotMatch(text, /recorded no casualties/);
  assert.match(text, /first report was recorded at 22 minutes after the drill started/);
  assert.match(text, /NSED Q4 2026 – UP Diliman Event Report PDF/);
  assert.match(text, /GRAND TOTAL63798/);
  // UPRI's blanks stay highlighted.
  for (const blank of [
    '[Add the names and positions of the staff who prepared the report]',
    '[Add the comparison with the previous quarter’s NSED',
    '[Insert a screenshot of the event’s Overview from the IRS]',
    '[Add the overall assessment]',
  ]) {
    assert.ok(text.includes(blank), blank);
  }
  assert.match(xml, /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">\[Add/);
  // No one's name or signature, and no comments, from the report it was made from.
  assert.doesNotMatch(text, /Jimenez|Lagmay|Gundran/);
  assert.equal(zip.file('word/comments.xml'), null);
  assert.deepEqual(
    Object.keys(zip.files).filter((f) => f.startsWith('word/media/')),
    ['word/media/image1.jpg'],
    'only the letterhead'
  );
  assert.deepEqual(
    Object.keys(zip.files).filter((f) => f.endsWith('/')),
    [],
    'no folder entries'
  );
});

test('an event with no reports fills too', () => {
  const template = readFileSync('public/templates/nsed-report-diliman.docx');
  const zip = new PizZip(fillNsedDilimanTemplate(template, buildNsedDilimanReport(source([]))));
  const text = zip
    .file('word/document.xml')!
    .asText()
    .replace(/<[^>]+>/g, '');
  assert.doesNotMatch(text, /[{}]/);
  assert.match(text, /a total of 0 reports were received from 0 out of 5 clusters/);
  assert.match(text, /No reports were received\./);
  assert.match(text, /The submitted reports recorded no casualties\./);
  assert.doesNotMatch(text, /first report was recorded/);
});
