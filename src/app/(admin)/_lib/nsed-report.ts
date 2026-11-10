import { format } from 'date-fns';
import { formatTime } from './format';
import {
  bySubmitted,
  headcountChart,
  headcountColumns,
  orderedClusters,
  unitsOf,
} from './headcount-chart';
import { reportPlace as placeOf, reportTimeline, type SummarySource } from './summary';

// The NSED report for the UP Manila DRRM-H office: what the app fills into the office's Word
// template (public/templates/nsed-report.docx). Pure, so it can be tested; nsed-docx.ts puts it
// into the file. Everything the office writes itself stays a yellow [Add …] blank in the template.

type SummaryReport = SummarySource['reports'][number];

/** Template fields. Numbers come formatted ("1,592"); every value is plain text. */
export interface NsedReportData {
  quarterOrdinal: string;
  quarterOrdinalUpper: string;
  year: string;
  drillDate: string;
  drillWeekday: string;
  startTime: string;
  clusterHeadcounts: string;
  firstReportTime: string;
  timeline: { name: string; place: string; time: string }[];
  clusters: {
    name: string;
    units: string;
    headcount: string;
    missing: string;
    casualties: string;
    /** Where structural damage was reported, e.g. "College of Nursing (minor cracks)". */
    damage: string;
  }[];
  totalUnits: string;
  totalHeadcount: string;
  totalMissing: string;
  totalCasualties: string;
  totalDamage: string;
  breakdowns: {
    title: string;
    hasReports: boolean;
    table: NsedBreakdownTable;
    headcount: string;
    /** Missing persons, casualties and damage, ending in a space when not empty. */
    note: string;
  }[];
  chart: NsedChart;
}

/** One cluster's units (rows) by headcount field, then Missing and Casualty, with a total row. */
export interface NsedBreakdownTable {
  /** "College/Unit (Pedro Gil)". */
  unitHeader: string;
  /** The short field names ("Faculty", "Construction W."), then "Missing" and "Casualty". */
  columns: string[];
  rows: { unit: string; counts: string[] }[];
  totals: string[];
}

/**
 * Headcount by category as a stacked bar chart: one bar per unit that reported, one stacked
 * series per field, then Missing and Casualty, with the bar's total at its end.
 */
export interface NsedChart {
  units: string[];
  series: { name: string; color: string; values: number[] }[];
  totals: number[];
}

/**
 * Which NSED report a campus gets, or null for none. UP Manila's DRRM-H office report also covers
 * PGH; UP Diliman's is UPRI's report to the UP President (nsed-diliman.ts).
 */
export type NsedTemplate = 'manila' | 'diliman';

export function nsedTemplateFor(campusName: string): NsedTemplate | null {
  const name = campusName.trim();
  if (/^(up|university of the philippines)[\s-]+manila$/i.test(name)) return 'manila';
  if (/^(pgh|philippine general hospital)$/i.test(name)) return 'manila';
  if (/^(up|university of the philippines)[\s-]+diliman$/i.test(name)) return 'diliman';
  return null;
}

export const ORDINALS = ['1st', '2nd', '3rd', '4th'];

export const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

// The same test summary.ts uses for "no damage".
const NO_DAMAGE = /^(none|no\b)|no visible/i;

export const num = (n: number) => n.toLocaleString('en-US');

/** "one (1)", as the office writes counts in sentences; digits past twenty. */
const counted = (n: number) => (n <= 20 ? `${WORDS[n]} (${n})` : num(n));

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "JUAN DELA CRUZ" or "juan dela cruz" → "Juan Dela Cruz"; roman numerals stay ("Jose Rizal III"). */
export function properName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(
      /(^|[\s\-'.])(\p{L})/gu,
      (_, before: string, letter: string) => before + letter.toUpperCase()
    )
    .replace(/\b(Ii|Iii|Iv|Vi|Vii)\b/g, (numeral) => numeral.toUpperCase());
}

/** "a", "a and b", "a, b, and c". */
export function list(items: string[], comma = items.length > 2) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')}${comma ? ',' : ''} and ${items[items.length - 1]}`;
}

/** "Minor injuries — no hospitalization needed" → "minor injuries". */
export function shortCondition(name: string) {
  const short = name
    .split(' — ')[0]
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
  return /^[A-Z][a-z]/.test(short) ? short.charAt(0).toLowerCase() + short.slice(1) : short;
}

/** Q1–Q4 and the year: from the Quarter field, then the event name, then the start date. */
export function quarterOf(event: SummarySource['event'], start: Date | null) {
  for (const text of [event.quarter, event.name]) {
    const match = text?.match(/\bQ\s*([1-4])\b(?:\D{0,3}(\d{4}))?/i);
    if (match) {
      const year = match[2] ?? (start ? String(start.getFullYear()) : '');
      if (year) return { quarter: Number(match[1]), year };
    }
  }
  if (!start) return null;
  return { quarter: Math.floor(start.getMonth() / 3) + 1, year: String(start.getFullYear()) };
}

/** "Pedro Gil Cluster", but "PGH" (an acronym) and "Taft cluster" stay as they are. */
function clusterTitle(name: string) {
  return /cluster$/i.test(name) || /^[A-Z]{2,}$/.test(name) ? name : `${name} Cluster`;
}

/** "the Pedro Gil cluster", for sentences. */
const clusterInSentence = (name: string) =>
  /cluster$/i.test(name) ? `the ${name}` : `the ${name} cluster`;

/** "the College of Nursing", but "PGH Zone 1" takes no article. */
function the(place: string) {
  return /\bzone\b/i.test(place) || /^the\b/i.test(place) ? place : `the ${place}`;
}

const peopleOf = (r: SummaryReport) => r.population_counts.reduce((sum, pc) => sum + pc.count, 0);

/** Structural damage in these reports: each place once per condition, "no damage" left out. */
function damageOf(reports: SummaryReport[]) {
  const seen = new Set<string>();
  const damage: { place: string; condition: string }[] = [];
  for (const r of reports) {
    const name = r.damage_conditions?.name;
    if (!name || NO_DAMAGE.test(name)) continue;
    const item = { place: placeOf(r), condition: shortCondition(name) };
    const key = `${item.place}|${item.condition}`;
    if (!seen.has(key)) {
      seen.add(key);
      damage.push(item);
    }
  }
  return damage;
}

/** Missing persons, casualties and damage in one cluster's reports, as the office writes them. */
function noteOf(reports: SummaryReport[]) {
  const byPlace = new Map<string, SummaryReport[]>();
  for (const r of reports) {
    const place = placeOf(r);
    byPlace.set(place, [...(byPlace.get(place) ?? []), r]);
  }
  const places = [...byPlace.entries()];
  const sentences: string[] = [];

  // Named missing persons, one clause per place.
  const named = places.flatMap(([place, rs]) => {
    const names = rs.flatMap((r) =>
      r.missing_persons.map((p) => properName(p.name)).filter(Boolean)
    );
    if (!names.length) return [];
    return [
      `${list(names)} ${names.length === 1 ? 'was' : 'were'} reported missing at ${the(place)}`,
    ];
  });
  if (named.length) sentences.push(`${capitalize(list(named, true))}.`);

  // Missing persons without a name, counted per place.
  for (const [place, rs] of places) {
    const people = rs.flatMap((r) => r.missing_persons);
    const unnamed = people.filter((p) => !p.name.trim()).length;
    if (!unnamed) continue;
    const also = unnamed < people.length;
    sentences.push(
      `${capitalize(the(place))} ${also ? 'also ' : ''}reported ${counted(unnamed)} ${also ? 'more ' : ''}missing ${
        unnamed === 1 ? 'person, but the name was' : 'persons, but names were'
      } not provided.`
    );
  }

  // Casualties per place, by condition.
  for (const [place, rs] of places) {
    const casualties = rs.flatMap((r) => r.casualties);
    if (!casualties.length) continue;
    const byCondition = new Map<string, number>();
    for (const c of casualties) {
      const condition = shortCondition(c.condition.name);
      byCondition.set(condition, (byCondition.get(condition) ?? 0) + 1);
    }
    const conditions = [...byCondition.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([condition, n]) => `${condition} (${n})`);
    sentences.push(
      `${capitalize(the(place))} reported ${num(casualties.length)} ${
        casualties.length === 1 ? 'casualty' : 'casualties'
      }: ${list(conditions)}.`
    );
  }

  // Building damage.
  const damaged = damageOf(reports).map((d) => `${the(d.place)} (${d.condition})`);
  sentences.push(
    damaged.length
      ? `Building damage was reported at ${list(damaged)}.`
      : 'No building damage was reported.'
  );

  return `${sentences.join(' ')} `;
}

export function buildNsedReport(source: SummarySource): NsedReportData {
  const { event } = source;
  const reports = bySubmitted(source.reports);
  const firstAt = reports[0] ? new Date(reports[0].submitted_at) : null;
  const start = event.started_at ? new Date(event.started_at) : firstAt;
  const quarter = quarterOf(event, start);

  const clusters = orderedClusters(source, reports);

  const clusterRows = clusters.map((c) => ({
    ...c,
    units: new Set(c.reports.map((r) => r.unit_id ?? 'none')).size,
    headcount: c.reports.reduce((sum, r) => sum + peopleOf(r), 0),
    missing: c.reports.reduce((sum, r) => sum + r.missing_persons.length, 0),
    casualties: c.reports.reduce((sum, r) => sum + r.casualties.length, 0),
    damage: damageOf(c.reports),
  }));
  const total = (key: 'units' | 'headcount' | 'missing' | 'casualties') =>
    clusterRows.reduce((sum, c) => sum + c[key], 0);
  const damagedAreas = clusterRows.reduce((sum, c) => sum + c.damage.length, 0);

  const { columns, countsOf } = headcountColumns(source, reports);
  const chart = headcountChart(source);
  const chartUnits = chart.clusters.flatMap((c) => c.units);

  return {
    quarterOrdinal: quarter ? ORDINALS[quarter.quarter - 1] : '',
    quarterOrdinalUpper: quarter ? ORDINALS[quarter.quarter - 1].toUpperCase() : '',
    year: quarter?.year ?? '',
    drillDate: start ? format(start, 'MMMM d, yyyy') : '—',
    drillWeekday: start ? format(start, 'EEEE') : '—',
    startTime: formatTime(start),
    clusterHeadcounts: list(
      clusterRows.map((c) =>
        c.reports.length
          ? `${num(c.headcount)} from ${clusterInSentence(c.name)}`
          : `no report from ${clusterInSentence(c.name)}`
      ),
      true
    ),
    firstReportTime: formatTime(firstAt),
    timeline: reportTimeline(reports).map((t) => ({
      name: t.name,
      place: t.place,
      time: formatTime(t.at),
    })),
    clusters: clusterRows.map((c) => ({
      name: c.name,
      units: num(c.units),
      headcount: num(c.headcount),
      missing: num(c.missing),
      casualties: num(c.casualties),
      damage: c.damage.length
        ? c.damage.map((d) => `${d.place} (${d.condition})`).join('; ')
        : 'None reported',
    })),
    totalUnits: num(total('units')),
    totalHeadcount: num(total('headcount')),
    totalMissing: num(total('missing')),
    totalCasualties: num(total('casualties')),
    totalDamage: damagedAreas
      ? `${num(damagedAreas)} ${damagedAreas === 1 ? 'area' : 'areas'}`
      : 'None reported',
    breakdowns: clusterRows.map((c) => {
      const units = unitsOf(c.reports);
      return {
        title: clusterTitle(c.name),
        hasReports: c.reports.length > 0,
        table: {
          unitHeader: `College/Unit (${c.name})`,
          columns: columns.map((col) => col.name),
          rows: units.map((u) => ({ unit: u.name, counts: countsOf(u.reports).map(num) })),
          totals: countsOf(c.reports).map(num),
        },
        headcount: num(c.headcount),
        note: c.reports.length ? noteOf(units.flatMap((u) => u.reports)) : '',
      };
    }),
    chart: {
      units: chartUnits.map((u) => u.name),
      series: chart.series.map(({ name, color }, i) => ({
        name,
        color,
        values: chartUnits.map((u) => u.values[i]),
      })),
      totals: chartUnits.map((u) => u.total),
    },
  };
}

/** "NSED Report Q1 2026.docx", like the office names it. */
export function nsedFileName(source: SummarySource) {
  const start = source.event.started_at ? new Date(source.event.started_at) : null;
  const quarter = quarterOf(source.event, start);
  return quarter ? `NSED Report Q${quarter.quarter} ${quarter.year}.docx` : `NSED Report.docx`;
}
