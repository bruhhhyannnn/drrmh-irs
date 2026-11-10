import type { SummarySource } from './summary';

// Headcount by category, unit by unit: the stacked bar chart in the NSED report (nsed-docx.ts)
// and on the event summary's Headcount card. Pure, so the two agree and it can be tested.

type SummaryReport = SummarySource['reports'][number];

// UP Manila's clusters in the order the office's report lists them; any other cluster follows,
// by name.
const CLUSTER_ORDER = ['pedro gil', 'padre faura', 'taft', 'pgh'];

// The office's short names for the headcount fields (column headers and the chart legend) and
// the chart colours of its reports; a field not listed keeps its name and takes a spare colour.
// Hex without the #, as Word takes them.
const FIELD_STYLES: { match: RegExp; label: string; color: string }[] = [
  { match: /^faculty/i, label: 'Faculty', color: '1A5E80' },
  { match: /^admin/i, label: 'Admin', color: 'E87333' },
  { match: /^reps/i, label: 'REPS', color: '1A6B2A' },
  { match: /^ra\b/i, label: 'RA', color: '12A0D8' },
  { match: /^student/i, label: 'Students', color: '9C2A91' },
  { match: /^philcare/i, label: 'Philcare', color: '4CA935' },
  { match: /^security/i, label: 'Security', color: '6390A8' },
  { match: /^construction/i, label: 'Construction W.', color: 'F0A070' },
  { match: /^tenant/i, label: 'Tenants', color: '5E9C6C' },
  { match: /^health/i, label: 'Health W.', color: '5CC1EA' },
  { match: /^non[\s-]?academic/i, label: 'Non-academic staff', color: 'C474BC' },
  { match: /^(visitor|guest|patient)/i, label: 'Visitors/Patients', color: '8CC870' },
];
const MISSING_COLOR = 'A4C2D2';
const CASUALTY_COLOR = 'F6C8AB';
const SPARE_COLORS = ['7F7F7F', 'BF9000', '4472C4', 'A5A5A5', '70AD47', 'FFC000'];

const zoneNumber = (unit: string | undefined) => Number(unit?.match(/^zone\s*(\d+)/i)?.[1] ?? NaN);

/** Reports in the order they were sent. */
export function bySubmitted(reports: SummaryReport[]) {
  return [...reports].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
}

/** Active clusters plus any inactive one that still has reports, in the office's order. */
export function orderedClusters(source: SummarySource, reports: SummaryReport[]) {
  const names = new Map(source.clusters.map((c) => [c.id, c.name]));
  for (const r of reports) if (!names.has(r.cluster_id)) names.set(r.cluster_id, r.cluster.name);
  const rank = (name: string) => {
    const i = CLUSTER_ORDER.indexOf(name.trim().toLowerCase());
    return i === -1 ? CLUSTER_ORDER.length : i;
  };
  return [...names.entries()]
    .map(([id, name]) => ({ id, name, reports: reports.filter((r) => r.cluster_id === id) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/** A cluster's reports by unit: zones by number (PGH), other units by their first report. */
export function unitsOf(reports: SummaryReport[]) {
  const byUnit = new Map<string, { key: string; name: string; reports: SummaryReport[] }>();
  for (const r of reports) {
    const key = r.unit_id ?? 'none';
    const unit = byUnit.get(key) ?? {
      key,
      name: r.unit?.name.trim() || 'No unit',
      reports: [],
    };
    unit.reports.push(r);
    byUnit.set(key, unit);
  }
  const units = [...byUnit.values()];
  const byZone = units.every((u) => !Number.isNaN(zoneNumber(u.name)));
  return byZone ? units.sort((a, b) => zoneNumber(a.name) - zoneNumber(b.name)) : units;
}

/**
 * The headcount columns: the campus's fields in their order, then any other field reported, then
 * Missing and Casualty; and `countsOf`, some reports' counts in that order.
 */
export function headcountColumns(source: SummarySource, reports: SummaryReport[]) {
  const categories = [...source.fields];
  for (const r of reports) {
    for (const pc of r.population_counts) {
      if (!categories.some((c) => c.id === pc.category.id)) categories.push(pc.category);
    }
  }
  let spare = 0;
  const fields = categories.map((c) => {
    const style = FIELD_STYLES.find((f) => f.match.test(c.name.trim()));
    return {
      id: c.id,
      label: style?.label ?? c.name,
      color: style?.color ?? SPARE_COLORS[spare++ % SPARE_COLORS.length],
    };
  });
  const countOf = (categoryId: string, rs: SummaryReport[]) =>
    rs.reduce(
      (sum, r) =>
        sum +
        r.population_counts
          .filter((pc) => pc.category.id === categoryId)
          .reduce((s, pc) => s + pc.count, 0),
      0
    );
  /** Some reports' counts: each field, then missing persons, then casualties. */
  const countsOf = (rs: SummaryReport[]) => [
    ...fields.map((f) => countOf(f.id, rs)),
    rs.reduce((sum, r) => sum + r.missing_persons.length, 0),
    rs.reduce((sum, r) => sum + r.casualties.length, 0),
  ];
  const columns = [
    ...fields.map((f) => ({ name: f.label, color: f.color })),
    { name: 'Missing', color: MISSING_COLOR },
    { name: 'Casualty', color: CASUALTY_COLOR },
  ];
  return { columns, countsOf };
}

export interface HeadcountChart {
  /** One stacked series per field, then Missing and Casualty, with its total over every unit. */
  series: { name: string; color: string; total: number }[];
  /** Clusters that reported, in the office's order, each with a bar per unit that reported. */
  clusters: {
    id: string;
    name: string;
    units: { key: string; name: string; values: number[]; total: number }[];
  }[];
}

/** Headcount by category, one bar per unit that reported, cluster by cluster. */
export function headcountChart(source: SummarySource): HeadcountChart {
  const reports = bySubmitted(source.reports);
  const { columns, countsOf } = headcountColumns(source, reports);
  const clusters = orderedClusters(source, reports)
    .filter((c) => c.reports.length)
    .map((c) => ({
      id: c.id,
      name: c.name,
      units: unitsOf(c.reports).map((u) => {
        const values = countsOf(u.reports);
        return {
          key: `${c.id}/${u.key}`,
          name: u.name,
          values,
          total: values.reduce((s, n) => s + n, 0),
        };
      }),
    }));
  const all = clusters.flatMap((c) => c.units);
  return {
    series: columns.map((col, i) => ({
      ...col,
      total: all.reduce((sum, u) => sum + u.values[i], 0),
    })),
    clusters,
  };
}
