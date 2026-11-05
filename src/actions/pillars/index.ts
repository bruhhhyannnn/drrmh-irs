'use server';

import { loadBuildingScores, loadRollupFacts } from '@/lib/assessment-records';
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
  type PillarGroup,
  type PillarMetrics,
  type PillarOverview,
} from '@/lib/pillar-metrics';
import { requireAdmin } from '@/lib/server-auth';
import { z } from 'zod';

// The DRRM pillar pages (DRRM-024): each pillar's assessment results, Campus beside Off-campus. The
// campus comes from requireAdmin: an Administrator sees their own whatever `campusId` says, and the
// off-campus buildings its ERT members assessed.

const uuidOrNull = (value: unknown) =>
  z.string().uuid().safeParse(value).success ? (value as string) : null;

const NO_LOCATION = { regionCode: null, provinceCode: null, cityCode: null, barangayCode: null };

/** Both groups of buildings a caller may see. */
function loadGroups(campusId: string | null) {
  return Promise.all([
    loadBuildingScores({ is_active: true, ...campusBuildings(campusId) }),
    loadBuildingScores({ is_active: true, ...offCampusBuildings(campusId) }),
  ]);
}

const campusChildren = (buildings: BuildingScores[], campusId: string | null): ChildRow[] =>
  groupChildren(buildings, campusId ? 'campus' : 'all');

const offCampusChildren = (buildings: BuildingScores[]): ChildRow[] =>
  openLocationLevel(buildings, NO_LOCATION).children;

async function scoredGroup(
  buildings: BuildingScores[],
  pillar: PillarCode,
  children: ChildRow[]
): Promise<PillarGroup> {
  const { facts, ids } = await loadRollupFacts(buildings);
  return pillarGroup(buildings, facts, ids, pillar, children);
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

  const [campus, offCampus] = await loadGroups(scope);
  if (pillar === RECOVERY_PILLAR) {
    return {
      kind: 'recovery',
      campus: recoveryGroup(campus, campusChildren(campus, scope)),
      off_campus: recoveryGroup(offCampus, offCampusChildren(offCampus)),
    };
  }
  const [campusGroup, offCampusGroup] = await Promise.all([
    scoredGroup(campus, pillar, campusChildren(campus, scope)),
    scoredGroup(offCampus, pillar, offCampusChildren(offCampus)),
  ]);
  return { kind: 'scored', campus: campusGroup, off_campus: offCampusGroup };
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
