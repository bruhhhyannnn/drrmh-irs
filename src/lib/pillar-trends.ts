import { percent, type Tally } from './assessment-score';
import type { BuildingScores, Named, PillarCode } from './assessment-template';
import type { BuildingCategory } from './building-place';
import type { AnswerFact } from './building-safety';

// The pillar page's trends and groupings (DRRM-027). Pure, so the page and the tests agree. Dates
// are grouped in Philippine time (UTC+8), where the assessments happen.

/** One assessment's tally in one pillar, for the charts over time. */
export interface HistoryRow {
  building_id: string;
  ended_at: string;
  tally: Tally;
}

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The year and month (0–11) a moment falls in, in Philippine time. */
function phMonth(time: number): { year: number; month: number } {
  const d = new Date(time + PH_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

const monthKey = (time: number) => {
  const { year, month } = phMonth(time);
  return year * 12 + month;
};
const quarterKey = (time: number) => {
  const { year, month } = phMonth(time);
  return year * 4 + Math.floor(month / 3);
};

const emptyTally = (): Tally => ({ safe: 0, counted: 0, na: 0 });
const add = (into: Tally, from: Tally) => {
  into.safe += from.safe;
  into.counted += from.counted;
  into.na += from.na;
};

export type Band = 'below_50' | 'from_50' | 'from_70' | 'from_85';

const BANDS: { band: Band; label: string; from: number }[] = [
  { band: 'below_50', label: 'Below 50%', from: 0 },
  { band: 'from_50', label: '50–69%', from: 50 },
  { band: 'from_70', label: '70–84%', from: 70 },
  { band: 'from_85', label: '85%+', from: 85 },
];

/** Buildings by their latest score in this pillar. One that counted nothing has no score. */
export function scoreBands(
  buildings: BuildingScores[],
  pillar: PillarCode
): { bands: { band: Band; label: string; buildings: Named[] }[]; noScore: number } {
  const bands = BANDS.map(({ band, label }) => ({ band, label, buildings: [] as Named[] }));
  let noScore = 0;
  for (const b of buildings) {
    if (!b.latest) continue;
    const score = percent(b.latest.pillars[pillar]);
    if (score === null) {
      noScore += 1;
      continue;
    }
    const index = BANDS.findLastIndex((band) => score >= band.from);
    bands[index].buildings.push({ id: b.id, name: b.name });
  }
  return { bands, noScore };
}

/** Re-assessed buildings, by whether this pillar's rounded score went up, stayed or went down. */
export function changeCounts(
  buildings: BuildingScores[],
  pillar: PillarCode
): { worse: Named[]; same: Named[]; better: Named[] } {
  const result = { worse: [] as Named[], same: [] as Named[], better: [] as Named[] };
  for (const b of buildings) {
    if (!b.latest || !b.previous) continue;
    const now = percent(b.latest.pillars[pillar]);
    const before = percent(b.previous.pillars[pillar]);
    if (now === null || before === null) continue;
    const named = { id: b.id, name: b.name };
    if (now > before) result.better.push(named);
    else if (now < before) result.worse.push(named);
    else result.same.push(named);
  }
  return result;
}

/**
 * The pillar score at the end of each of the last `quarters` quarters, oldest first: each
 * building's latest assessment by then, pooled. Quarters before the first assessment are left out.
 */
export function quarterlyTrend(
  history: HistoryRow[],
  now: Date,
  quarters = 8
): { label: string; tally: Tally | null }[] {
  const last = quarterKey(now.getTime());
  const rows = history
    .map((r) => ({ ...r, time: Date.parse(r.ended_at) }))
    .filter((r) => r.time <= now.getTime())
    .sort((a, b) => a.time - b.time);
  const points: { label: string; tally: Tally | null }[] = [];
  for (let key = last - quarters + 1; key <= last; key++) {
    const latest = new Map<string, Tally>();
    for (const r of rows) if (quarterKey(r.time) <= key) latest.set(r.building_id, r.tally);
    const tally = latest.size > 0 ? emptyTally() : null;
    if (tally) for (const t of latest.values()) add(tally, t);
    points.push({ label: `Q${(key % 4) + 1} ${Math.floor(key / 4)}`, tally });
  }
  const first = points.findIndex((p) => p.tally !== null);
  return first === -1 ? [] : points.slice(first);
}

/** Assessments that ended in each of the last `months` months, oldest first. */
export function monthlyActivity(
  history: HistoryRow[],
  now: Date,
  months = 12
): { label: string; count: number }[] {
  const last = monthKey(now.getTime());
  const counts = new Map<number, number>();
  for (const r of history) {
    const key = monthKey(Date.parse(r.ended_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const result: { label: string; count: number }[] = [];
  for (let key = last - months + 1; key <= last; key++) {
    result.push({ label: MONTHS[key % 12], count: counts.get(key) ?? 0 });
  }
  return result;
}

/** Buildings whose latest assessment is more than `days` old. Never-assessed ones aren't here. */
export function overdueBuildings(buildings: BuildingScores[], now: Date, days = 365): Named[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return buildings
    .filter((b) => b.latest && Date.parse(b.latest.ended_at) < cutoff)
    .map((b) => ({ id: b.id, name: b.name }));
}

export type FailingBuilding = Named & { label: string; category: BuildingCategory };

/** For each item in this pillar, the buildings whose latest assessment answered it unsafely. */
export function failingBuildings(
  facts: AnswerFact[],
  currentIds: string[],
  buildingOf: Map<string, FailingBuilding>,
  pillar: PillarCode
): Record<string, FailingBuilding[]> {
  const current = new Set(currentIds);
  const result: Record<string, FailingBuilding[]> = {};
  for (const f of facts) {
    if (f.pillar_code !== pillar || !current.has(f.assessment_id)) continue;
    if (f.answer === 'na' || f.answer === f.safe_answer) continue;
    const b = buildingOf.get(f.assessment_id);
    if (!b) continue;
    const list = (result[f.label] ??= []);
    if (!list.some((x) => x.id === b.id)) list.push(b);
  }
  return result;
}

export interface PillarTrends {
  /** Latest assessments the checklist flagged for follow-up. */
  needsFollowUp: number;
  /** Active buildings never assessed (campus buildings listed in Settings). */
  notYetAssessed: number;
  bands: ReturnType<typeof scoreBands>;
  changes: ReturnType<typeof changeCounts>;
  trend: ReturnType<typeof quarterlyTrend>;
  activity: ReturnType<typeof monthlyActivity>;
  overdue: Named[];
  failing: Record<string, FailingBuilding[]>;
}

/** The pillar page's charts and drill-downs for one group of buildings (Campus or Off-campus). */
export function pillarTrends(input: {
  buildings: BuildingScores[];
  history: HistoryRow[];
  facts: AnswerFact[];
  currentIds: string[];
  pillar: PillarCode;
  now: Date;
}): PillarTrends {
  const { buildings, history, facts, currentIds, pillar, now } = input;
  const buildingOf = new Map<string, FailingBuilding>();
  for (const b of buildings) {
    if (b.latest) {
      buildingOf.set(b.latest.id, { id: b.id, name: b.name, label: b.label, category: b.category });
    }
  }
  return {
    needsFollowUp: buildings.filter((b) => b.latest?.needs_follow_up).length,
    notYetAssessed: buildings.filter((b) => !b.latest).length,
    bands: scoreBands(buildings, pillar),
    changes: changeCounts(buildings, pillar),
    trend: quarterlyTrend(history, now),
    activity: monthlyActivity(history, now),
    overdue: overdueBuildings(buildings, now),
    failing: failingBuildings(facts, currentIds, buildingOf, pillar),
  };
}
