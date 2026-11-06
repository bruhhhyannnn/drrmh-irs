import { percent, recoveryStatus, type Tally } from './assessment-score';
import type { BuildingScores, Named, PillarCode } from './assessment-template';
import {
  mostFailed,
  pointsChange,
  poolBuildings,
  sectionScores,
  type AnswerFact,
  type ChildRow,
  type FailedItem,
  type SectionRow,
} from './building-safety';
import type { PillarTrends } from './pillar-trends';

// What each DRRM pillar page shows for one group of buildings, Campus or Off-campus (DRRM-025).
// Scores pool as everywhere else. The N/A rate sits beside them because a score leaves N/A out: a
// building marking most items N/A can score high on very few answers, and a high rate off campus
// says the checklist may not suit those buildings.

export const RECOVERY_PILLAR: PillarCode = 'rehabilitation-recovery';

/** N/A answers as a share of everything answered; null when nothing was. */
export function naRate(t: Tally): number | null {
  const answered = t.counted + t.na;
  return answered === 0 ? null : t.na / answered;
}

export interface NaItem {
  label: string;
  prompt_en: string;
  prompt_fil: string;
  /** Latest assessments that marked it N/A… */
  na: number;
  /** …out of those that answered it at all. */
  of: number;
}

/** This pillar's items most often marked N/A in the latest assessments. */
export function mostNa(
  facts: AnswerFact[],
  currentIds: string[],
  pillar: PillarCode,
  limit = 5
): NaItem[] {
  const current = new Set(currentIds);
  const items = new Map<string, NaItem>();
  for (const f of facts) {
    if (f.pillar_code !== pillar || !current.has(f.assessment_id)) continue;
    const item = items.get(f.label) ?? {
      label: f.label,
      prompt_en: f.prompt_en,
      prompt_fil: f.prompt_fil,
      na: 0,
      of: 0,
    };
    item.of += 1;
    if (f.answer === 'na') item.na += 1;
    items.set(f.label, item);
  }
  return [...items.values()]
    .filter((item) => item.na > 0)
    .sort((a, b) => b.na - a.na || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export interface LowBuilding extends Named {
  label: string;
  category: BuildingScores['category'];
  tally: Tally;
}

/** The lowest-scoring buildings in this pillar. One that counted nothing here has no score. */
export function lowestBuildings(
  buildings: BuildingScores[],
  pillar: PillarCode,
  limit = 5
): LowBuilding[] {
  return buildings
    .flatMap((b) => {
      const tally = b.latest?.pillars[pillar];
      return tally && tally.counted > 0
        ? [{ id: b.id, name: b.name, label: b.label, category: b.category, tally }]
        : [];
    })
    .sort(
      (a, b) => (percent(a.tally) ?? 0) - (percent(b.tally) ?? 0) || a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

export interface PlaceScore extends Named {
  assessed: number;
  tally: Tally;
}

export interface PillarGroup {
  assessed: number;
  reassessed: number;
  tally: Tally;
  change: number | null;
  naRate: number | null;
  places: PlaceScore[];
  lowest: LowBuilding[];
  sections: SectionRow[];
  mostFailed: FailedItem[];
  mostNa: NaItem[];
}

/** One group's metrics for a scored pillar. `children` are its campuses, clusters or places. */
export function pillarGroup(
  buildings: BuildingScores[],
  facts: AnswerFact[],
  ids: { current: string[]; lflCurrent: string[]; lflPrevious: string[] },
  pillar: PillarCode,
  children: ChildRow[]
): PillarGroup {
  const pooled = poolBuildings(buildings);
  const lfl = pooled.likeForLike;
  const inPillar = facts.filter((f) => f.pillar_code === pillar);
  const tally = pooled.current.pillars[pillar];
  return {
    assessed: pooled.assessed,
    reassessed: pooled.reassessed,
    tally,
    change: lfl ? pointsChange(lfl.previous.pillars[pillar], lfl.current.pillars[pillar]) : null,
    naRate: naRate(tally),
    places: children.map((row) => ({
      id: row.id,
      name: row.name,
      assessed: row.assessed,
      tally: row.current.pillars[pillar],
    })),
    lowest: lowestBuildings(buildings, pillar),
    sections: sectionScores(inPillar, ids),
    mostFailed: mostFailed(inPillar, ids.current).find((g) => g.pillar === pillar)?.items ?? [],
    mostNa: mostNa(facts, ids.current, pillar),
  };
}

export interface RecoveryGroup {
  in_place: number;
  missing: number;
  na: number;
  missingBuildings: (Named & { label: string; category: BuildingScores['category'] })[];
  places: (Named & { has: number; of: number })[];
}

/** Recovery has one item, the continuity plan, so it reads as counts instead of a percent. */
export function recoveryGroup(buildings: BuildingScores[], children: ChildRow[]): RecoveryGroup {
  const group: RecoveryGroup = {
    in_place: 0,
    missing: 0,
    na: 0,
    missingBuildings: [],
    places: children.map((row) => ({
      id: row.id,
      name: row.name,
      has: row.pscp.has,
      of: row.pscp.of,
    })),
  };
  for (const b of buildings) {
    if (!b.latest) continue;
    const status = recoveryStatus(b.latest.pillars[RECOVERY_PILLAR]);
    group[status] += 1;
    if (status === 'missing') {
      group.missingBuildings.push({ id: b.id, name: b.name, label: b.label, category: b.category });
    }
  }
  return group;
}

/** One group's numbers plus its charts and drill-downs (DRRM-027). */
export type ScoredView = PillarGroup & PillarTrends;
export type RecoveryView = RecoveryGroup & PillarTrends;

export type PillarMetrics =
  | { kind: 'scored'; campus: ScoredView; off_campus: ScoredView }
  | { kind: 'recovery'; campus: RecoveryView; off_campus: RecoveryView };

export interface PillarOverviewRow {
  pillar: PillarCode;
  campus: Tally;
  off_campus: Tally;
}

export interface PillarOverview {
  assessed: { campus: number; off_campus: number };
  rows: PillarOverviewRow[];
}
