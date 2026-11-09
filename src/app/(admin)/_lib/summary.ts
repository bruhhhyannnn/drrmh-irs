import type { getEventSummarySource } from '@/actions/events';
import { personMeta, type PersonSex } from '@/components/ds/people';
import { format } from 'date-fns';
import { formatTime, personName, plural } from './format';
import type { Tone } from './status';

// The event summary shared by campus details, event details and the report PDF: one pure
// function from an event's reports to everything the page prints. Nothing here fetches.

export type SummarySource = NonNullable<Awaited<ReturnType<typeof getEventSummarySource>>>;
type SummaryReport = SummarySource['reports'][number];

const MINUTE = 60_000;

/* ─── Severity ───────────────────────────────────────────────────────────────────────── */

export interface Level {
  rank: number;
  tone: Tone;
  color: string;
}

// Casualty and damage conditions are free-text lookup values in Settings, so severity is read
// from their wording. Lower rank = more severe for casualties; higher = worse for damage.
const CASUALTY_LEVELS: (Level & { test: RegExp })[] = [
  { test: /deceas|fatal|dead|died/i, rank: 0, tone: 'grey', color: 'var(--gray-700)' },
  { test: /critical|unconscious|unrespons/i, rank: 1, tone: 'red', color: 'var(--error-800)' },
  { test: /serious|severe|major/i, rank: 2, tone: 'red', color: '#d92d20' },
  { test: /moderate/i, rank: 3, tone: 'amber', color: '#f79009' },
  { test: /minor|light/i, rank: 4, tone: 'amber', color: '#fdb022' },
];
const OTHER_CASUALTY: Level = { rank: 5, tone: 'neutral', color: 'var(--gray-400)' };

function casualtyLevel(condition: string): Level {
  return CASUALTY_LEVELS.find((l) => l.test.test(condition)) ?? OTHER_CASUALTY;
}

const DAMAGE_LEVELS: (Level & { test: RegExp })[] = [
  { test: /^(none|no\b)|no visible/i, rank: 0, tone: 'green', color: '#12b76a' },
  { test: /total|condemn/i, rank: 5, tone: 'grey', color: 'var(--gray-700)' },
  { test: /partial/i, rank: 4, tone: 'red', color: 'var(--error-800)' },
  { test: /major|unsafe|severe|structural/i, rank: 3, tone: 'red', color: '#d92d20' },
  { test: /moderate/i, rank: 2, tone: 'amber', color: '#f79009' },
  { test: /minor|cosmetic|light/i, rank: 1, tone: 'amber', color: '#fdb022' },
];
const OTHER_DAMAGE: Level = { rank: 2, tone: 'amber', color: 'var(--gray-400)' };

function damageLevel(condition: string): Level {
  return DAMAGE_LEVELS.find((l) => l.test.test(condition)) ?? OTHER_DAMAGE;
}

const isNoDamage = (condition: string) => damageLevel(condition).rank === 0;

/* ─── Rows ───────────────────────────────────────────────────────────────────────────── */

export interface ClusterRow {
  id: string;
  name: string;
  reports: number;
  casualties: number;
  people: number;
  firstAt: Date;
  /** `id` is null for the reports filed without a unit. */
  units: { id: string | null; name: string; people: number }[];
  coverage: UnitCoverage | null;
}

/**
 * Which of a cluster's active units have reported. Null when the cluster has no units to expect,
 * or is inactive and so has no list. Reports without a unit, or for a deactivated unit, stay in
 * the people counts but don't count here.
 */
export interface UnitCoverage {
  total: number;
  reported: number;
  missing: { id: string; name: string }[];
}

export interface CasualtyRow {
  id: string;
  name: string;
  who: string;
  condition: string;
  level: Level;
  diagnosis: string | null;
  clusterId: string;
  cluster: string;
  unit: string;
  at: Date;
}

export interface MissingRow {
  id: string;
  name: string;
  identified: boolean;
  who: string;
  clusterId: string;
  cluster: string;
  unit: string;
  reportedBy: string;
  at: Date;
}

export interface CountRow {
  name: string;
  count: number;
  color: string;
}

export interface Summary {
  source: SummarySource;
  /** The event's start, or its first report when no start time was set. */
  start: Date | null;
  /** Completed events are read as of their end time; the rest as of now. */
  asOf: Date;
  completed: boolean;
  totals: {
    people: number;
    reports: number;
    casualties: number;
    missing: number;
    serious: number;
    unidentified: number;
    clustersCounted: number;
  };
  clusters: {
    done: ClusterRow[];
    pending: { id: string; name: string; coverage: UnitCoverage | null }[];
    /** Active clusters at the campus. */
    total: number;
    /** Active clusters with at least one report. */
    reported: number;
  };
  headcount: { rows: { id: string; name: string; count: number }[]; fieldsTotal: number };
  casualties: CasualtyRow[];
  casualtiesByCondition: CountRow[];
  missing: MissingRow[];
  times: Date[];
  /** Minutes from the start to each cluster's first report, fastest first. */
  firstReport: { id: string; name: string; minutes: number | null }[];
  damage: {
    unitsReported: number;
    byCondition: CountRow[];
    withDamage: { id: string; unit: string; cluster: string; condition: string; level: Level }[];
  };
}

const toSex = (sex: string | null): PersonSex =>
  sex === 'male' || sex === 'female' ? sex : 'unknown';

function who(person: { age: number | null; sex: string | null }) {
  const meta = personMeta({ name: '', age: person.age, sex: toSex(person.sex) });
  return meta === 'No details added' ? 'No details' : meta;
}

/* ─── Narrowing to a cluster or unit ─────────────────────────────────────────────────── */

/** The `unit` link value for the reports filed without a unit. */
export const NO_UNIT = 'none';

export interface SummaryScope {
  clusterId: string;
  clusterName: string;
  /** A unit's id or `NO_UNIT`; null when the whole cluster is in view. */
  unitId: string | null;
  unitName: string | null;
}

export interface ScopeTarget {
  clusterId: string | null;
  unitId?: string | null;
}

/** The source as if the event only had this cluster or unit; `buildSummary` takes it unchanged. */
export function scopeSource(
  source: SummarySource,
  { clusterId, unitId }: Pick<SummaryScope, 'clusterId' | 'unitId'>
): SummarySource {
  return {
    ...source,
    clusters: source.clusters.filter((c) => c.id === clusterId),
    reports: source.reports.filter(
      (r) =>
        r.cluster_id === clusterId &&
        (!unitId || (unitId === NO_UNIT ? !r.unit_id : r.unit_id === unitId))
    ),
  };
}

/**
 * Reads the scope from a link. A cluster counts if it's active at the campus or has reports (an
 * inactive one can), and a unit if it's active in that cluster or has reports there. Anything
 * else is a bad link, which shows the whole event.
 */
export function resolveScope(
  source: SummarySource,
  { cluster, unit }: { cluster: string | null; unit: string | null }
): { scope: SummaryScope | null; invalid: boolean } {
  const bad = { scope: null, invalid: true };
  if (!cluster) return unit ? bad : { scope: null, invalid: false };

  const active = source.clusters.find((c) => c.id === cluster);
  const reports = source.reports.filter((r) => r.cluster_id === cluster);
  const clusterName = active?.name ?? reports[0]?.cluster.name;
  if (!clusterName) return bad;
  const whole = { clusterId: cluster, clusterName };
  if (!unit) return { scope: { ...whole, unitId: null, unitName: null }, invalid: false };

  const unitName =
    unit === NO_UNIT
      ? reports.some((r) => !r.unit_id) && 'No unit'
      : (active?.units.find((u) => u.id === unit)?.name ??
        reports.find((r) => r.unit_id === unit)?.unit?.name);
  if (!unitName) return bad;
  return { scope: { ...whole, unitId: unit, unitName }, invalid: false };
}

/** A link to a scope, keeping the page's other params. `pins` are params to set as well. */
export function scopeHref(
  pathname: string,
  params: { toString(): string },
  { clusterId, unitId }: ScopeTarget,
  pins: Record<string, string> = {}
) {
  const next = new URLSearchParams(params.toString());
  next.delete('cluster');
  next.delete('unit');
  for (const [key, value] of Object.entries(pins)) next.set(key, value);
  if (clusterId) next.set('cluster', clusterId);
  if (clusterId && unitId) next.set('unit', unitId);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** The unit coverage of a summary narrowed to one cluster. */
export function scopedCoverage(summary: Summary) {
  const { done, pending } = summary.clusters;
  return done[0]?.coverage ?? pending[0]?.coverage ?? null;
}

/**
 * Where a report came from, as the timeline and the NSED report name it: the unit, "PGH Zone 1"
 * for a zone, or "Taft cluster" when the report has no unit.
 */
export function reportPlace(r: Pick<SummaryReport, 'cluster' | 'unit'>) {
  const unit = r.unit?.name.trim();
  if (!unit) return `${r.cluster.name} cluster`;
  return /^zone\b/i.test(unit) ? `${r.cluster.name} ${unit}` : unit;
}

export interface TimelineRow {
  id: string;
  /** Who sent it, or "—" when the account has no name. */
  name: string;
  place: string;
  at: Date;
}

/** The timeline of reports: who reported from where, in the order they were sent. */
export function reportTimeline(reports: SummaryReport[]): TimelineRow[] {
  return reports
    .map((r) => ({
      id: r.id,
      name: personName(r.user) || '—',
      place: reportPlace(r),
      at: new Date(r.submitted_at),
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Headcount per field over some reports, largest first; fields at 0 are left out. */
export function headcountOf(reports: SummaryReport[]) {
  const totals = new Map<string, { id: string; name: string; count: number }>();
  for (const r of reports) {
    for (const pc of r.population_counts) {
      const row = totals.get(pc.category.id);
      if (row) row.count += pc.count;
      else totals.set(pc.category.id, { ...pc.category, count: pc.count });
    }
  }
  return [...totals.values()].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
}

export const peopleOf = (r: SummaryReport) =>
  r.population_counts.reduce((sum, pc) => sum + pc.count, 0);

export function buildSummary(
  source: SummarySource,
  lists: { casualtyConditions: string[]; damageConditions: string[] },
  now = new Date()
): Summary {
  const { event, reports, clusters } = source;
  const completed = event.status.name.toLowerCase() === 'completed';
  const times = reports.map((r) => new Date(r.submitted_at));
  const start = event.started_at ? new Date(event.started_at) : (times[0] ?? null);
  const asOf = completed && event.ended_at ? new Date(event.ended_at) : now;

  const coverageOf = (clusterId: string): UnitCoverage | null => {
    const units = clusters.find((c) => c.id === clusterId)?.units ?? [];
    // A unit added after a completed event was never expected to report for it.
    const expected = units.filter(
      (u) => !(completed && event.ended_at) || new Date(u.created_at) <= new Date(event.ended_at)
    );
    if (!expected.length) return null;
    const reportedIds = new Set(
      reports.filter((r) => r.cluster_id === clusterId).map((r) => r.unit_id)
    );
    const missing = expected
      .filter((u) => !reportedIds.has(u.id))
      .map(({ id, name }) => ({ id, name }));
    return { total: expected.length, reported: expected.length - missing.length, missing };
  };

  // Clusters, in the order they first reported.
  const byCluster = new Map<string, ClusterRow>();
  for (const r of reports) {
    let row = byCluster.get(r.cluster_id);
    if (!row) {
      row = {
        id: r.cluster_id,
        name: r.cluster.name,
        reports: 0,
        casualties: 0,
        people: 0,
        firstAt: new Date(r.submitted_at),
        units: [],
        coverage: coverageOf(r.cluster_id),
      };
      byCluster.set(r.cluster_id, row);
    }
    const people = peopleOf(r);
    row.reports++;
    row.casualties += r.casualties.length;
    row.people += people;
    const unitName = r.unit?.name ?? 'No unit';
    const unit = row.units.find((u) => u.name === unitName);
    if (unit) unit.people += people;
    else row.units.push({ id: r.unit_id, name: unitName, people });
  }
  const done = [...byCluster.values()].sort((a, b) => a.firstAt.getTime() - b.firstAt.getTime());
  done.forEach((row) => row.units.sort((a, b) => b.people - a.people));
  const pending = clusters
    .filter((c) => !byCluster.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, coverage: coverageOf(c.id) }));
  const reportedActive = clusters.filter((c) => byCluster.has(c.id)).length;

  const casualties: CasualtyRow[] = reports
    .flatMap((r) =>
      r.casualties.map((c) => ({
        id: c.id,
        name: c.name || 'Unknown person',
        who: who(c),
        condition: c.condition.name,
        level: casualtyLevel(c.condition.name),
        diagnosis: c.diagnosis?.trim() || null,
        clusterId: r.cluster_id,
        cluster: r.cluster.name,
        unit: r.unit?.name ?? 'No unit',
        at: new Date(r.submitted_at),
      }))
    )
    .sort((a, b) => a.level.rank - b.level.rank || a.at.getTime() - b.at.getTime());

  const missing: MissingRow[] = reports.flatMap((r) =>
    r.missing_persons.map((p) => ({
      id: p.id,
      name: p.name || 'Unknown person',
      identified: !!p.name,
      who: who(p),
      clusterId: r.cluster_id,
      cluster: r.cluster.name,
      unit: r.unit?.name ?? 'No unit',
      reportedBy: personName(r.user) || '—',
      at: new Date(r.submitted_at),
    }))
  );

  const conditionNames = [
    ...lists.casualtyConditions,
    ...casualties.map((c) => c.condition).filter((n) => !lists.casualtyConditions.includes(n)),
  ];
  const casualtiesByCondition = [...new Set(conditionNames)]
    .map((name) => ({
      name,
      count: casualties.filter((c) => c.condition === name).length,
      color: casualtyLevel(name).color,
    }))
    .sort((a, b) => casualtyLevel(b.name).rank - casualtyLevel(a.name).rank);

  const damageNames = [
    ...lists.damageConditions,
    ...reports
      .map((r) => r.damage_conditions?.name)
      .filter((n): n is string => !!n && !lists.damageConditions.includes(n)),
  ];
  const byCondition = [...new Set(damageNames)]
    .map((name) => ({
      name,
      count: reports.filter((r) => r.damage_conditions?.name === name).length,
      color: damageLevel(name).color,
    }))
    .sort((a, b) => damageLevel(a.name).rank - damageLevel(b.name).rank);
  const withDamage = reports
    .filter((r) => r.damage_conditions && !isNoDamage(r.damage_conditions.name))
    .map((r) => ({
      id: r.id,
      unit: r.unit?.name ?? 'No unit',
      cluster: r.cluster.name,
      condition: r.damage_conditions!.name,
      level: damageLevel(r.damage_conditions!.name),
    }))
    .sort((a, b) => b.level.rank - a.level.rank);

  const firstReport = [
    ...done.map((row) => ({
      id: row.id,
      name: row.name,
      minutes: start
        ? Math.max(0, Math.round((row.firstAt.getTime() - start.getTime()) / MINUTE))
        : 0,
    })),
    ...pending.map((c) => ({ id: c.id, name: c.name, minutes: null })),
  ].sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));

  return {
    source,
    start,
    asOf,
    completed,
    totals: {
      people: reports.reduce((sum, r) => sum + peopleOf(r), 0),
      reports: reports.length,
      casualties: casualties.length,
      missing: missing.length,
      serious: casualties.filter((c) => c.level.rank <= 2).length,
      unidentified: missing.filter((m) => !m.identified).length,
      clustersCounted: done.filter((row) => row.people > 0).length,
    },
    clusters: { done, pending, total: clusters.length, reported: reportedActive },
    headcount: { rows: headcountOf(reports), fieldsTotal: source.fields.length },
    casualties,
    casualtiesByCondition,
    missing,
    times,
    firstReport,
    damage: { unitsReported: reports.length, byCondition, withDamage },
  };
}

/* ─── Reports received over time ─────────────────────────────────────────────────────── */

const BIN_SIZES = [10, 15, 20, 30, 60, 120, 180, 360, 720, 1440];

/** Bin size (minutes) and count that fit every report of the given summaries in ≤ 12 bars. */
export function timelineScale(summaries: Summary[]) {
  const spans = summaries.map((s) =>
    s.start && s.times.length
      ? Math.max(...s.times.map((t) => (t.getTime() - s.start!.getTime()) / MINUTE), 0)
      : 0
  );
  const span = Math.max(0, ...spans);
  const binMinutes = BIN_SIZES.find((b) => Math.floor(span / b) + 1 <= 12) ?? 1440;
  const bins = Math.max(binMinutes === 10 ? 6 : 1, Math.floor(span / binMinutes) + 1);
  return { binMinutes, bins };
}

/** Reports per bin from the start; reports sent before the start count in the first bin. */
export function timelineOf(summary: Summary, scale: { binMinutes: number; bins: number }) {
  const counts = Array.from({ length: scale.bins }, () => 0);
  if (!summary.start) return counts;
  for (const t of summary.times) {
    const offset = Math.max(0, (t.getTime() - summary.start.getTime()) / MINUTE);
    counts[Math.min(scale.bins - 1, Math.floor(offset / scale.binMinutes))]++;
  }
  return counts;
}

/** "9:10" for each bin; dates once bins are a day long. */
export function timelineLabels(summary: Summary, scale: { binMinutes: number; bins: number }) {
  return Array.from({ length: scale.bins }, (_, i) => {
    if (!summary.start) return `${i * scale.binMinutes}m`;
    const at = new Date(summary.start.getTime() + i * scale.binMinutes * MINUTE);
    return format(at, scale.binMinutes >= 1440 ? 'MMM d' : 'h:mm');
  });
}

/** First report, the time half the reports were in by, and the last report. */
export function timelineMilestones(summary: Summary) {
  const sorted = [...summary.times].sort((a, b) => a.getTime() - b.getTime());
  if (!sorted.length) return { first: '—', half: '—', last: '—' };
  return {
    first: formatTime(sorted[0]),
    half: formatTime(sorted[Math.ceil(sorted.length / 2) - 1]),
    last: formatTime(sorted[sorted.length - 1]),
  };
}

/** Axis maximum for time to first report: at least an hour, in 15-minute steps. */
export function firstReportScale(summaries: Summary[]) {
  const longest = Math.max(
    0,
    ...summaries.flatMap((s) => s.firstReport.map((r) => r.minutes ?? 0))
  );
  return Math.max(60, Math.ceil(longest / 15) * 15);
}

/* ─── Compare with last drill ────────────────────────────────────────────────────────── */

export type ChangeTone = 'good' | 'bad' | 'same';

export interface CompareRow {
  measure: string;
  a: string;
  b: string;
  change: string;
  tone: ChangeTone;
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const minutesAfterStart = (s: Summary, t: Date | undefined) =>
  s.start && t ? Math.round((t.getTime() - s.start.getTime()) / MINUTE) : null;

/** When the last active cluster sent its first report, or null if one never did. */
function allReportedAt(s: Summary) {
  if (!s.clusters.total || s.clusters.pending.length) return null;
  return s.clusters.done.reduce<Date | undefined>(
    (latest, row) => (!latest || row.firstAt > latest ? row.firstAt : latest),
    undefined
  );
}

/** "3 more" / "3 fewer" / "Same", toned by whether more is better, worse or neither. */
function countChange(
  a: number,
  b: number,
  moreIs: ChangeTone | 'neutral'
): Pick<CompareRow, 'change' | 'tone'> {
  if (a === b) return { change: 'Same', tone: 'same' };
  const diff = Math.abs(a - b);
  const more = a > b;
  const tone: ChangeTone =
    moreIs === 'neutral' ? 'same' : more === (moreIs === 'good') ? 'good' : 'bad';
  return { change: `${diff.toLocaleString()} ${more ? 'more' : 'fewer'}`, tone };
}

/** Minutes after the start; fewer is better. */
function minuteChange(a: number | null, b: number | null, faster: string, slower: string) {
  if (a === null || b === null) return { change: '—', tone: 'same' as ChangeTone };
  if (a === b) return { change: 'Same', tone: 'same' as ChangeTone };
  const diff = Math.abs(a - b);
  return a < b
    ? { change: `${diff} min ${faster}`, tone: 'good' as ChangeTone }
    : { change: `${diff} min ${slower}`, tone: 'bad' as ChangeTone };
}

export function compareSummaries(a: Summary, b: Summary): CompareRow[] {
  const firstA = [...a.times].sort((x, y) => x.getTime() - y.getTime())[0];
  const firstB = [...b.times].sort((x, y) => x.getTime() - y.getTime())[0];
  const medianA = median(a.firstReport.flatMap((r) => (r.minutes === null ? [] : [r.minutes])));
  const medianB = median(b.firstReport.flatMap((r) => (r.minutes === null ? [] : [r.minutes])));
  const allA = allReportedAt(a);
  const allB = allReportedAt(b);

  const allChange: Pick<CompareRow, 'change' | 'tone'> = !allA
    ? a.clusters.pending.length
      ? {
          change: `${plural(a.clusters.pending.length, 'cluster', 'clusters')} missing`,
          tone: 'bad',
        }
      : { change: '—', tone: 'same' }
    : !allB
      ? { change: 'Reached this time', tone: 'good' }
      : minuteChange(minutesAfterStart(a, allA), minutesAfterStart(b, allB), 'earlier', 'later');

  return [
    {
      measure: 'Clusters reported',
      a: `${a.clusters.reported} of ${a.clusters.total}`,
      b: `${b.clusters.reported} of ${b.clusters.total}`,
      ...countChange(a.clusters.reported, b.clusters.reported, 'good'),
    },
    {
      measure: 'First report',
      a: firstA ? formatTime(firstA) : '—',
      b: firstB ? formatTime(firstB) : '—',
      ...minuteChange(
        minutesAfterStart(a, firstA),
        minutesAfterStart(b, firstB),
        'earlier',
        'later'
      ),
    },
    {
      measure: 'Median time to first report',
      a: medianA === null ? '—' : `${medianA} min`,
      b: medianB === null ? '—' : `${medianB} min`,
      ...minuteChange(medianA, medianB, 'faster', 'slower'),
    },
    {
      measure: 'All clusters reported by',
      a: allA ? formatTime(allA) : 'Not reached',
      b: allB ? formatTime(allB) : 'Not reached',
      ...allChange,
    },
    {
      measure: 'Reports',
      a: a.totals.reports.toLocaleString(),
      b: b.totals.reports.toLocaleString(),
      ...countChange(a.totals.reports, b.totals.reports, 'neutral'),
    },
    {
      measure: 'People affected',
      a: a.totals.people.toLocaleString(),
      b: b.totals.people.toLocaleString(),
      ...countChange(a.totals.people, b.totals.people, 'neutral'),
    },
    {
      measure: 'Casualties',
      a: String(a.totals.casualties),
      b: String(b.totals.casualties),
      ...countChange(a.totals.casualties, b.totals.casualties, 'bad'),
    },
    {
      measure: 'Missing persons',
      a: String(a.totals.missing),
      b: String(b.totals.missing),
      ...countChange(a.totals.missing, b.totals.missing, 'bad'),
    },
    {
      measure: 'Units with damage',
      a: String(a.damage.withDamage.length),
      b: String(b.damage.withDamage.length),
      ...countChange(a.damage.withDamage.length, b.damage.withDamage.length, 'bad'),
    },
  ];
}

/** "Q4 2026" from the quarter field, or the event name when there is none. */
export const shortLabel = (s: Summary) => s.source.event.quarter || s.source.event.name;
