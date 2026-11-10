'use server';

import { loadBuildingScores, loadPillarHistory, loadRollupFacts } from '@/lib/assessment-records';
import { PILLAR_CODES, type BuildingScores, type PillarCode } from '@/lib/assessment-template';
import { campusBuildings, offCampusBuildings } from '@/lib/building-place';
import {
  groupChildren,
  openLocationLevel,
  poolBuildings,
  type ChildRow,
} from '@/lib/building-safety';
import {
  pillarGroup,
  RECOVERY_PILLAR,
  recoveryGroup,
  type PillarMetrics,
  type PillarOverview,
} from '@/lib/pillar-metrics';
import { pillarTrends } from '@/lib/pillar-trends';
import { requireAdmin } from '@/lib/server-auth';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

// The DRRM pillar pages (DRRM-025): each pillar's assessment results, Campus beside Off-campus. The
// campus comes from requireAdmin: an Administrator sees their own whatever `campusId` says, and the
// off-campus buildings its ERT members assessed.

const uuidOrNull = (value: unknown) =>
  z.string().uuid().safeParse(value).success ? (value as string) : null;

const NO_LOCATION = { regionCode: null, provinceCode: null, cityCode: null, barangayCode: null };

/** Who may see which buildings: Campus, and Off-campus (owned by the campus, or by none). */
const groupWhere = (campusId: string | null) => ({
  campus: { is_active: true, ...campusBuildings(campusId) },
  off_campus: { is_active: true, ...offCampusBuildings(campusId) },
});

/** Both groups of buildings a caller may see. */
function loadGroups(campusId: string | null) {
  const where = groupWhere(campusId);
  return Promise.all([loadBuildingScores(where.campus), loadBuildingScores(where.off_campus)]);
}

const campusChildren = (buildings: BuildingScores[], campusId: string | null): ChildRow[] =>
  groupChildren(buildings, campusId ? 'campus' : 'all');

const offCampusChildren = (buildings: BuildingScores[]): ChildRow[] =>
  openLocationLevel(buildings, NO_LOCATION).children;

/** One group's numbers, charts and drill-downs. Recovery reads as counts (one item). */
async function groupView(
  buildings: BuildingScores[],
  where: Prisma.BuildingWhereInput,
  pillar: PillarCode,
  children: ChildRow[],
  now: Date
) {
  const [{ facts, ids }, history] = await Promise.all([
    loadRollupFacts(buildings),
    loadPillarHistory(where, pillar),
  ]);
  const trends = pillarTrends({ buildings, history, facts, currentIds: ids.current, pillar, now });
  return { facts, ids, trends };
}

/** One pillar's metrics. null when the caller isn't an admin or the pillar doesn't exist. */
export async function getPillarMetrics(
  token: string | null,
  slug: string,
  campusId?: string | null
): Promise<PillarMetrics | null> {
  const pillar = PILLAR_CODES.find((code) => code === slug);
  if (!pillar) return null;
  const caller = await requireAdmin(token, uuidOrNull(campusId));
  if (!caller.ok) return null;
  const scope = caller.scope.campusId;
  const where = groupWhere(scope);
  const now = new Date();

  const [campus, offCampus] = await loadGroups(scope);
  const campusKids = campusChildren(campus, scope);
  const offKids = offCampusChildren(offCampus);
  const [campusView, offView] = await Promise.all([
    groupView(campus, where.campus, pillar, campusKids, now),
    groupView(offCampus, where.off_campus, pillar, offKids, now),
  ]);

  if (pillar === RECOVERY_PILLAR) {
    return {
      kind: 'recovery',
      campus: { ...recoveryGroup(campus, campusKids), ...campusView.trends },
      off_campus: { ...recoveryGroup(offCampus, offKids), ...offView.trends },
    };
  }
  const scored = (
    buildings: BuildingScores[],
    view: Awaited<ReturnType<typeof groupView>>,
    kids: ChildRow[]
  ) => ({
    ...pillarGroup(buildings, view.facts, view.ids, pillar, kids),
    ...view.trends,
  });
  return {
    kind: 'scored',
    campus: scored(campus, campusView, campusKids),
    off_campus: scored(offCampus, offView, offKids),
  };
}

/** All four pillars side by side, for /pillars. null when the caller isn't an admin. */
export async function getPillarOverview(
  token: string | null,
  campusId?: string | null
): Promise<PillarOverview | null> {
  const caller = await requireAdmin(token, uuidOrNull(campusId));
  if (!caller.ok) return null;

  const [campusList, offCampusList] = await loadGroups(caller.scope.campusId);
  const campus = poolBuildings(campusList);
  const offCampus = poolBuildings(offCampusList);
  return {
    assessed: { campus: campus.assessed, off_campus: offCampus.assessed },
    rows: PILLAR_CODES.map((pillar) => ({
      pillar,
      campus: campus.current.pillars[pillar],
      off_campus: offCampus.current.pillars[pillar],
    })),
  };
}
