import { percent, recoveryStatus, type AssessmentScore, type Tally } from './assessment-score';
import {
  PILLAR_CODES,
  type AssessmentTemplate,
  type BuildingScores,
  type Named,
  type PillarCode,
  type ScoredAssessment,
} from './assessment-template';

// The admin side of the building assessment (DRRM-015 Phase 2): turning stored pillar rows into
// scores, the change between two assessments, and the dashboard rollup (spec 4.3). Pure code, so
// the Buildings list, the dashboard and the tests agree.

const emptyTally = (): Tally => ({ safe: 0, counted: 0, na: 0 });

/** An assessment's four assessment_pillar_scores rows as pillar tallies, and their sum. */
export function scoresFromPillarRows(
  rows: { code: string; safe_count: number; counted_count: number; na_count: number }[]
): { overall: Tally; pillars: Record<PillarCode, Tally> } {
  const pillars = Object.fromEntries(PILLAR_CODES.map((p) => [p, emptyTally()])) as Record<
    PillarCode,
    Tally
  >;
  const overall = emptyTally();
  for (const row of rows) {
    if (!(PILLAR_CODES as readonly string[]).includes(row.code)) continue;
    const tally = pillars[row.code as PillarCode];
    tally.safe += row.safe_count;
    tally.counted += row.counted_count;
    tally.na += row.na_count;
    overall.safe += row.safe_count;
    overall.counted += row.counted_count;
    overall.na += row.na_count;
  }
  return { overall, pillars };
}

/** The change in percentage points from `before` to `after`; null when either counted nothing. */
export function pointsChange(
  before: Tally | null | undefined,
  after: Tally | null | undefined
): number | null {
  const a = before ? percent(before) : null;
  const b = after ? percent(after) : null;
  return a === null || b === null ? null : b - a;
}

/* ─── Dashboard rollup ─── */

export type RollupLevel = 'all' | 'campus' | 'cluster' | 'unit';

export interface Pooled {
  overall: Tally;
  pillars: Record<PillarCode, Tally>;
}

/** A group of buildings: how many, how many assessed, and their pooled scores. */
export interface RollupGroup {
  buildings: number;
  assessed: number;
  /** Assessed at least twice: the only ones that count toward a change. */
  reassessed: number;
  /** Every building's latest assessment, pooled (not an average of percentages). */
  current: Pooled;
  /** The re-assessed buildings' previous and latest, pooled; null when none was re-assessed. */
  likeForLike: { previous: Pooled; current: Pooled } | null;
  /** Public Service Continuity Plan: latest assessments with it, of those that answered it, and
   * the change in `has` among the re-assessed buildings. */
  pscp: { has: number; of: number; change: number | null };
  lastAssessedAt: string | null;
}

export interface ChildRow extends Named, RollupGroup {
  kind: 'campus' | 'cluster' | 'unit' | 'building';
}

const RECOVERY: PillarCode = 'rehabilitation-recovery';

function addTally(into: Tally, from: Tally) {
  into.safe += from.safe;
  into.counted += from.counted;
  into.na += from.na;
}

function pool(scores: ScoredAssessment[]): Pooled {
  const pooled = scoresFromPillarRows([]);
  for (const s of scores) {
    for (const code of PILLAR_CODES) addTally(pooled.pillars[code], s.pillars[code]);
    addTally(pooled.overall, s.overall);
  }
  return pooled;
}

const hasPlan = (s: ScoredAssessment) => recoveryStatus(s.pillars[RECOVERY]) === 'in_place';

export function poolBuildings(buildings: BuildingScores[]): RollupGroup {
  const latest = buildings.flatMap((b) => (b.latest ? [b.latest] : []));
  const again = buildings.filter((b) => b.latest && b.previous);
  const now = again.map((b) => b.latest!);
  const before = again.map((b) => b.previous!);
  return {
    buildings: buildings.length,
    assessed: latest.length,
    reassessed: again.length,
    current: pool(latest),
    likeForLike: again.length > 0 ? { previous: pool(before), current: pool(now) } : null,
    pscp: {
      has: latest.filter(hasPlan).length,
      of: latest.filter((s) => recoveryStatus(s.pillars[RECOVERY]) !== 'na').length,
      change: again.length > 0 ? now.filter(hasPlan).length - before.filter(hasPlan).length : null,
    },
    lastAssessedAt: latest.reduce<string | null>(
      (max, s) => (max === null || s.ended_at > max ? s.ended_at : max),
      null
    ),
  };
}

const CHILD_OF: Record<RollupLevel, { kind: ChildRow['kind']; of: (b: BuildingScores) => Named }> =
  {
    all: { kind: 'campus', of: (b) => b.campus },
    campus: { kind: 'cluster', of: (b) => b.cluster },
    cluster: { kind: 'unit', of: (b) => b.unit },
    unit: { kind: 'building', of: (b) => ({ id: b.id, name: b.name }) },
  };

/** The level's children (campuses, clusters, units or buildings), each pooled, by name. */
export function groupChildren(buildings: BuildingScores[], level: RollupLevel): ChildRow[] {
  const { kind, of } = CHILD_OF[level];
  const groups = new Map<string, { named: Named; list: BuildingScores[] }>();
  for (const b of buildings) {
    const named = of(b);
    const group = groups.get(named.id) ?? { named, list: [] };
    group.list.push(b);
    groups.set(named.id, group);
  }
  return [...groups.values()]
    .map(({ named, list }) => ({ id: named.id, name: named.name, kind, ...poolBuildings(list) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One scored answer, with what the section table and the most-failed list need. */
export interface AnswerFact {
  assessment_id: string;
  section_code: string;
  section_order: number;
  section_title_en: string;
  section_title_fil: string;
  /** "V.4": matches the same item across checklist versions. */
  label: string;
  prompt_en: string;
  prompt_fil: string;
  pillar_code: PillarCode | null;
  answer: 'yes' | 'no' | 'na';
  safe_answer: 'yes' | 'no';
}

export interface SectionRow {
  code: string;
  title_en: string;
  title_fil: string;
  current: Tally;
  change: number | null;
}

function addFact(t: Tally, f: AnswerFact) {
  if (f.answer === 'na') {
    t.na += 1;
    return;
  }
  t.counted += 1;
  if (f.answer === f.safe_answer) t.safe += 1;
}

/** Each section pooled over the latest assessments, with the like-for-like change. */
export function sectionScores(
  facts: AnswerFact[],
  ids: { current: string[]; lflCurrent: string[]; lflPrevious: string[] }
): SectionRow[] {
  const current = new Set(ids.current);
  const lflCurrent = new Set(ids.lflCurrent);
  const lflPrevious = new Set(ids.lflPrevious);
  const rows = new Map<string, { fact: AnswerFact; now: Tally; lflNow: Tally; lflThen: Tally }>();
  for (const f of facts) {
    const row = rows.get(f.section_code) ?? {
      fact: f,
      now: emptyTally(),
      lflNow: emptyTally(),
      lflThen: emptyTally(),
    };
    if (current.has(f.assessment_id)) addFact(row.now, f);
    if (lflCurrent.has(f.assessment_id)) addFact(row.lflNow, f);
    if (lflPrevious.has(f.assessment_id)) addFact(row.lflThen, f);
    rows.set(f.section_code, row);
  }
  return [...rows.values()]
    .filter((r) => r.now.counted + r.now.na > 0)
    .sort((a, b) => a.fact.section_order - b.fact.section_order)
    .map((r) => ({
      code: r.fact.section_code,
      title_en: r.fact.section_title_en,
      title_fil: r.fact.section_title_fil,
      current: r.now,
      change: pointsChange(r.lflThen, r.lflNow),
    }));
}

export interface FailedItem {
  label: string;
  prompt_en: string;
  prompt_fil: string;
  /** Latest assessments that gave the unsafe answer… */
  unsafe: number;
  /** …out of those that answered it YES or NO. */
  of: number;
}

/** The most often unsafe items in the latest assessments, top `perPillar` per pillar. */
export function mostFailed(
  facts: AnswerFact[],
  currentIds: string[],
  perPillar = 5
): { pillar: PillarCode; items: FailedItem[] }[] {
  const current = new Set(currentIds);
  const items = new Map<string, { item: FailedItem; pillar: PillarCode | null }>();
  for (const f of facts) {
    if (!current.has(f.assessment_id) || f.answer === 'na') continue;
    const entry = items.get(f.label) ?? {
      item: { label: f.label, prompt_en: f.prompt_en, prompt_fil: f.prompt_fil, unsafe: 0, of: 0 },
      pillar: f.pillar_code,
    };
    entry.item.of += 1;
    if (f.answer !== f.safe_answer) entry.item.unsafe += 1;
    items.set(f.label, entry);
  }
  return PILLAR_CODES.map((pillar) => ({
    pillar,
    items: [...items.values()]
      .filter((e) => e.pillar === pillar && e.item.unsafe > 0)
      .map((e) => e.item)
      .sort((a, b) => b.unsafe - a.unsafe || a.label.localeCompare(b.label))
      .slice(0, perPillar),
  })).filter((g) => g.items.length > 0);
}

/* ─── One building: compare two of its assessments ─── */

export interface CompareRow {
  key: string;
  title_en: string;
  title_fil?: string;
  a: Tally | null;
  b: Tally | null;
  change: number | null;
}

export interface Comparison {
  overall: CompareRow;
  /** One per pillar, `key` the pillar code. */
  pillars: CompareRow[];
  sections: CompareRow[];
  /** A and B were answered with different checklist versions; sections match by code. */
  versionsDiffer: boolean;
}

type Side = { template: AssessmentTemplate; score: AssessmentScore };

const compareRow = (
  key: string,
  title_en: string,
  a: Tally | null,
  b: Tally | null,
  title_fil?: string
): CompareRow => ({ key, title_en, title_fil, a, b, change: pointsChange(a, b) });

/** A against B: overall, the four pillars, and the sections either one had, by section code. */
export function compareScores(a: Side, b: Side): Comparison {
  const bySection = (side: Side) =>
    new Map(
      side.template.sections
        .filter((s) => side.score.sections[s.id])
        .map((s) => [s.code, { section: s, tally: side.score.sections[s.id] }])
    );
  const aSections = bySection(a);
  const bSections = bySection(b);
  const codes = [...bSections.keys(), ...[...aSections.keys()].filter((c) => !bSections.has(c))];
  return {
    overall: compareRow('overall', 'Overall', a.score.overall, b.score.overall),
    pillars: PILLAR_CODES.map((code) =>
      compareRow(code, code, a.score.pillars[code], b.score.pillars[code])
    ),
    sections: codes.map((code) => {
      const { section } = (bSections.get(code) ?? aSections.get(code))!;
      return compareRow(
        code,
        section.title_en,
        aSections.get(code)?.tally ?? null,
        bSections.get(code)?.tally ?? null,
        section.title_fil
      );
    }),
    versionsDiffer: a.template.version_id !== b.template.version_id,
  };
}

/** Which two assessments to compare, `historyIds` oldest first: the picks when they're known and
 * differ, else the previous against the latest. */
export function comparePair(
  historyIds: string[],
  a?: string | null,
  b?: string | null
): { a: string | null; b: string | null } {
  if (historyIds.length === 0) return { a: null, b: null };
  const known = (id?: string | null): id is string => !!id && historyIds.includes(id);
  const pickB = known(b) ? b : historyIds[historyIds.length - 1];
  if (known(a) && a !== pickB) return { a, b: pickB };
  const previous = historyIds[historyIds.length - 2];
  if (previous && previous !== pickB) return { a: previous, b: pickB };
  const newestOther = [...historyIds].reverse().find((id) => id !== pickB);
  return { a: newestOther ?? null, b: pickB };
}

/* ─── The dashboard section's URL state ─── */

export interface DashboardScope {
  /** null: the server decides (an Administrator's own campus), or All campuses. */
  campusId: string | null;
  clusterId: string | null;
  unitId: string | null;
  buildingId: string | null;
  a: string | null;
  b: string | null;
}

/** The drill-down level from the `bs_` params. An Administrator's campus never comes from the URL. */
export function scopeFromParams(
  params: URLSearchParams,
  opts: { isSuperAdmin: boolean; switcherCampusId: string }
): DashboardScope {
  const get = (key: string) => params.get(key) || null;
  return {
    campusId: opts.isSuperAdmin ? (get('bs_campus') ?? (opts.switcherCampusId || null)) : null,
    clusterId: get('bs_cluster'),
    unitId: get('bs_unit'),
    buildingId: get('bs_building'),
    a: get('bs_a'),
    b: get('bs_b'),
  };
}

/* ─── What the dashboard actions return ─── */

export interface SafetyRollup {
  level: RollupLevel;
  /** The breadcrumb above the level (an Administrator's starts at their campus). */
  trail: { campus?: Named; cluster?: Named; unit?: Named };
  group: RollupGroup;
  children: ChildRow[];
  notAssessed: Named[];
  sections: SectionRow[];
  mostFailed: { pillar: PillarCode; items: FailedItem[] }[];
}

export interface BuildingHistory {
  building: Named & { unit: Named; cluster: Named; campus: Named };
  /** Oldest first; `number` is #1…#n by when they ended. */
  assessments: (ScoredAssessment & { number: number; version_label: string })[];
}
