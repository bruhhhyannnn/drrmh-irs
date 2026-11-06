'use server';

import { inScope } from '@/lib/admin-scope';
import {
  loadBuildingScores,
  loadRollupFacts,
  loadVersion,
  scoredSelect,
  toScoredAssessment,
} from '@/lib/assessment-records';
import { scoreAssessment, type AnswerMap } from '@/lib/assessment-score';
import { type AssessmentTemplate } from '@/lib/assessment-template';
import {
  buildingPlaceSelect,
  campusBuildings,
  offCampusBuildings,
  toBuildingPlace,
} from '@/lib/building-place';
import {
  compareScores,
  groupChildren,
  mostFailed,
  openLocationLevel,
  poolBuildings,
  sectionScores,
  type BuildingHistory,
  type Comparison,
  type LocationScope,
  type OffCampusRollup,
  type RollupLevel,
  type SafetyRollup,
} from '@/lib/building-safety';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/server-auth';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

// The dashboard's Building safety section (DRRM-015 Phase 2, spec 4.3). The campus always comes
// from requireAdmin: an Administrator gets their own whatever `campusId` says, so a cluster or
// unit id from another campus finds nothing. The arithmetic is in src/lib/building-safety.ts.

const uuidOrNull = (value: unknown) =>
  z.string().uuid().safeParse(value).success ? (value as string) : null;

/** One level of the drill-down: the pooled scores, its children, sections and most-failed items.
 * null when the caller isn't an admin or the cluster/unit isn't in their campus. */
export async function getSafetyRollup(
  token: string | null,
  scope: { campusId?: string | null; clusterId?: string | null; unitId?: string | null }
): Promise<SafetyRollup | null> {
  const caller = await requireAdmin(token, uuidOrNull(scope.campusId));
  if (!caller.ok) return null;
  const campusId = caller.scope.campusId;
  const clusterId = uuidOrNull(scope.clusterId);
  const unitId = uuidOrNull(scope.unitId);
  const level: RollupLevel = unitId ? 'unit' : clusterId ? 'cluster' : campusId ? 'campus' : 'all';

  const where: Prisma.BuildingWhereInput = {
    AND: [
      campusBuildings(campusId),
      {
        is_active: true,
        ...(unitId && { unit_id: unitId }),
        ...(clusterId && { unit: { cluster_id: clusterId } }),
      },
    ],
  };

  const [campus, cluster, unit, buildings] = await Promise.all([
    campusId
      ? prisma.campus.findUnique({ where: { id: campusId }, select: { id: true, name: true } })
      : null,
    clusterId
      ? prisma.cluster.findFirst({
          where: { id: clusterId, ...(campusId && { campus_id: campusId }) },
          select: { id: true, name: true },
        })
      : null,
    unitId
      ? prisma.unit.findFirst({
          where: {
            id: unitId,
            ...(clusterId && { cluster_id: clusterId }),
            ...(campusId && { cluster: { campus_id: campusId } }),
          },
          select: { id: true, name: true },
        })
      : null,
    loadBuildingScores(where),
  ]);
  if ((clusterId && !cluster) || (unitId && !unit)) return null;

  const { facts, ids } = await loadRollupFacts(buildings);

  return {
    level,
    trail: {
      ...(campus && { campus }),
      ...(cluster && { cluster }),
      ...(unit && { unit }),
    },
    group: poolBuildings(buildings),
    children: groupChildren(buildings, level),
    notAssessed: buildings.filter((b) => !b.latest).map((b) => ({ id: b.id, name: b.name })),
    sections: sectionScores(facts, ids),
    mostFailed: mostFailed(facts, ids.current),
  };
}

const codeOrNull = (value: unknown) =>
  typeof value === 'string' && /^\d{10}$/.test(value) ? value : null;

/** One level of the off-campus drill-down (DRRM-025). An Administrator sees the off-campus
 * buildings their own campus assessed. null when the caller isn't an admin. */
export async function getOffCampusRollup(
  token: string | null,
  scope: { campusId?: string | null } & LocationScope
): Promise<OffCampusRollup | null> {
  const caller = await requireAdmin(token, uuidOrNull(scope.campusId));
  if (!caller.ok) return null;
  const location: LocationScope = {
    regionCode: codeOrNull(scope.regionCode),
    provinceCode: codeOrNull(scope.provinceCode),
    cityCode: codeOrNull(scope.cityCode),
    barangayCode: codeOrNull(scope.barangayCode),
  };

  const buildings = await loadBuildingScores({
    is_active: true,
    ...offCampusBuildings(caller.scope.campusId),
    ...(location.regionCode && { region_code: location.regionCode }),
    ...(location.provinceCode && { province_code: location.provinceCode }),
    ...(location.cityCode && { city_code: location.cityCode }),
    ...(location.barangayCode && { barangay_code: location.barangayCode }),
  });
  const { facts, ids } = await loadRollupFacts(buildings);

  return {
    ...openLocationLevel(buildings, location),
    group: poolBuildings(buildings),
    sections: sectionScores(facts, ids),
    mostFailed: mostFailed(facts, ids.current),
  };
}

/** A building's assessments numbered #1…#n, for the history line and the A/B pickers. */
export async function getBuildingHistory(
  token: string | null,
  buildingId: string
): Promise<BuildingHistory | null> {
  const id = uuidOrNull(buildingId);
  if (!id) return null;
  const caller = await requireAdmin(token);
  if (!caller.ok) return null;

  const building = await prisma.building.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      ...buildingPlaceSelect,
      assessments: {
        orderBy: { ended_at: 'asc' },
        select: { ...scoredSelect, version: { select: { label: true } } },
      },
    },
  });
  if (!building) return null;
  const place = toBuildingPlace(building);
  if (!inScope(caller.scope, place.campus.id)) return null;

  return {
    building: { id: building.id, name: building.name, ...place },
    assessments: building.assessments.map((a, i) => ({
      ...toScoredAssessment(a),
      number: i + 1,
      version_label: a.version.label,
    })),
  };
}

/** Two assessments of the same building side by side; null unless both are in scope. */
export async function compareAssessments(
  token: string | null,
  aId: string,
  bId: string
): Promise<Comparison | null> {
  const a = uuidOrNull(aId);
  const b = uuidOrNull(bId);
  if (!a || !b || a === b) return null;
  const caller = await requireAdmin(token);
  if (!caller.ok) return null;

  const rows = await prisma.assessment.findMany({
    where: { id: { in: [a, b] } },
    select: {
      id: true,
      building_id: true,
      floor_count: true,
      template_version_id: true,
      building: { select: buildingPlaceSelect },
      areas: { select: { area_type_id: true } },
      answers: { where: { answer: { not: null } }, select: { item_id: true, answer: true } },
    },
  });
  const rowA = rows.find((r) => r.id === a);
  const rowB = rows.find((r) => r.id === b);
  if (!rowA || !rowB || rowA.building_id !== rowB.building_id) return null;
  if (!inScope(caller.scope, toBuildingPlace(rowA.building).campus.id)) return null;

  const [vA, vB] =
    rowA.template_version_id === rowB.template_version_id
      ? await loadVersion({ id: rowA.template_version_id }).then((v) => [v, v] as const)
      : await Promise.all([
          loadVersion({ id: rowA.template_version_id }),
          loadVersion({ id: rowB.template_version_id }),
        ]);
  if (!vA || !vB) return null;

  const scoreRow = (row: typeof rowA, template: AssessmentTemplate) => {
    const answerMap: AnswerMap = Object.fromEntries(row.answers.map((r) => [r.item_id, r.answer]));
    return scoreAssessment(
      template,
      row.floor_count,
      row.areas.map((ar) => ar.area_type_id),
      answerMap
    );
  };

  return compareScores(
    { template: vA.template, score: scoreRow(rowA, vA.template) },
    { template: vB.template, score: scoreRow(rowB, vB.template) }
  );
}
