import { format } from 'date-fns';
import { formatTime } from './format';
import { bySubmitted, unitsOf } from './headcount-chart';
import { list, num, ORDINALS, quarterOf, shortCondition, WORDS } from './nsed-report';
import type { SummarySource } from './summary';

// The UP Diliman NSED report: UPRI's report to the UP President (DRRM-032), filled into
// public/templates/nsed-report-diliman.docx. Only what the IRS counts is filled in; the letter,
// the signatories, the observations and the comparison with the last quarter stay yellow
// [Add …] blanks for UPRI. Pure, so it can be tested; nsed-docx.ts puts it into the file.

type SummaryReport = SummarySource['reports'][number];

const MINUTE = 60_000;

/** Template fields. Numbers come formatted; every value is plain text. */
export interface NsedDilimanData {
  drillDate: string;
  quarter: string;
  quarterOrdinal: string;
  year: string;
  startTime: string;
  /** "10 reports" / "1 report", then "were" / "was". */
  reportCount: string;
  reportVerb: string;
  /** "8 out of 38 clusters". */
  clusterCount: string;
  /** "1,058 individuals". */
  individuals: string;
  /** "722 students, 106 administrative personnel and 8 construction workers". */
  categoryCounts: string;
  clustersReported: string;
  clustersTotal: string;
  hasCasualties: boolean;
  /** "three victims". */
  casualtyCount: string;
  /** "two individuals with moderate injuries and one individual with minor injuries". */
  casualtyBreakdown: string;
  hasReports: boolean;
  /** "22 minutes", from the start. */
  firstReportAfter: string;
  lastReportAfter: string;
  table: NsedClusterTable;
}

export interface NsedClusterCounts {
  reports: number;
  casualties: number;
  headcount: number;
}

/** Clusters that reported, first report first, each with its units' counts. */
export interface NsedClusterTable {
  clusters: (NsedClusterCounts & {
    name: string;
    units: (NsedClusterCounts & { name: string })[];
  })[];
  total: NsedClusterCounts;
}

/** Words to twenty, as UPRI writes counts of people; digits past that. */
const inWords = (n: number) => (n <= 20 ? WORDS[n] : num(n));

const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;

/** "Students" → "students", but "REPS" and "JO/COS Personnel" keep their capitals. */
const inSentence = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => (/^[A-Z0-9/&-]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(' ');

const countsOf = (reports: SummaryReport[]): NsedClusterCounts => ({
  reports: reports.length,
  casualties: reports.reduce((sum, r) => sum + r.casualties.length, 0),
  headcount: reports.reduce(
    (sum, r) => sum + r.population_counts.reduce((s, pc) => s + pc.count, 0),
    0
  ),
});

/** The table: clusters in the order they first reported, units likewise, with a grand total. */
export function clusterTableOf(reports: SummaryReport[]): NsedClusterTable {
  const byCluster = new Map<string, { name: string; reports: SummaryReport[] }>();
  for (const r of bySubmitted(reports)) {
    const cluster = byCluster.get(r.cluster_id) ?? { name: r.cluster.name, reports: [] };
    cluster.reports.push(r);
    byCluster.set(r.cluster_id, cluster);
  }
  return {
    clusters: [...byCluster.values()].map((c) => ({
      name: c.name,
      ...countsOf(c.reports),
      units: unitsOf(c.reports).map((u) => ({
        name: u.key === 'none' ? 'No unit specified' : u.name,
        ...countsOf(u.reports),
      })),
    })),
    total: countsOf(reports),
  };
}

export function buildNsedDilimanReport(source: SummarySource): NsedDilimanData {
  const reports = bySubmitted(source.reports);
  const firstAt = reports[0] ? new Date(reports[0].submitted_at) : null;
  const lastAt = reports.length ? new Date(reports[reports.length - 1].submitted_at) : null;
  const start = source.event.started_at ? new Date(source.event.started_at) : firstAt;
  const quarter = quarterOf(source.event, start);
  const table = clusterTableOf(reports);

  // Clusters: the campus's active ones, plus any inactive one that still reported.
  const clusterIds = new Set([
    ...source.clusters.map((c) => c.id),
    ...reports.map((r) => r.cluster_id),
  ]);
  const reported = table.clusters.length;

  // People by category, most first; categories at 0 left out.
  const byCategory = new Map<string, { name: string; count: number }>();
  for (const r of reports) {
    for (const pc of r.population_counts) {
      const row = byCategory.get(pc.category.id) ?? { name: pc.category.name, count: 0 };
      row.count += pc.count;
      byCategory.set(pc.category.id, row);
    }
  }
  const categories = [...byCategory.values()]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((c) => `${num(c.count)} ${inSentence(c.name)}`);

  // Casualties by condition, most first.
  const casualties = reports.flatMap((r) => r.casualties);
  const byCondition = new Map<string, number>();
  for (const c of casualties) {
    const condition = shortCondition(c.condition.name).toLowerCase();
    byCondition.set(condition, (byCondition.get(condition) ?? 0) + 1);
  }
  const breakdown = [...byCondition.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([condition, n]) =>
        `${inWords(n)} ${n === 1 ? 'individual' : 'individuals'} with ${condition}`
    );

  const minutesAfter = (t: Date | null) =>
    start && t ? Math.max(0, Math.round((t.getTime() - start.getTime()) / MINUTE)) : 0;

  return {
    drillDate: start ? format(start, 'MMMM d, yyyy') : '—',
    quarter: quarter ? String(quarter.quarter) : '',
    quarterOrdinal: quarter ? ORDINALS[quarter.quarter - 1] : '',
    year: quarter?.year ?? '',
    startTime: formatTime(start),
    reportCount: plural(reports.length, 'report', 'reports'),
    reportVerb: reports.length === 1 ? 'was' : 'were',
    clusterCount: `${num(reported)} out of ${plural(clusterIds.size, 'cluster', 'clusters')}`,
    individuals: plural(table.total.headcount, 'individual', 'individuals'),
    categoryCounts: categories.length ? list(categories, false) : 'no individuals',
    clustersReported: num(reported),
    clustersTotal: num(clusterIds.size),
    hasCasualties: casualties.length > 0,
    casualtyCount: `${inWords(casualties.length)} ${casualties.length === 1 ? 'victim' : 'victims'}`,
    casualtyBreakdown: list(breakdown, false),
    hasReports: reports.length > 0,
    firstReportAfter: plural(minutesAfter(firstAt), 'minute', 'minutes'),
    lastReportAfter: plural(minutesAfter(lastAt), 'minute', 'minutes'),
    table,
  };
}

/** "NSED-2026-Q4-UP-Diliman-report.docx", like UPRI names it. */
export function nsedDilimanFileName(source: SummarySource) {
  const start = source.event.started_at ? new Date(source.event.started_at) : null;
  const quarter = quarterOf(source.event, start);
  return quarter
    ? `NSED-${quarter.year}-Q${quarter.quarter}-UP-Diliman-report.docx`
    : 'NSED-UP-Diliman-report.docx';
}
