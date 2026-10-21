'use server';

import { inScope } from '@/lib/admin-scope';
import {
  loadBuildingScores,
  loadScoredItemMeta,
  loadVersion,
  scoredSelect,
  toScoredAssessment,
} from '@/lib/assessment-records';
import { scoreAssessment, type AnswerMap } from '@/lib/assessment-score';
import { type AssessmentTemplate } from '@/lib/assessment-template';
import {
  compareScores,
  groupChildren,
  mostFailed,
  poolBuildings,
  sectionScores,
  type AnswerFact,
  type BuildingHistory,
  type Comparison,
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
    is_active: true,
    ...(unitId && { unit_id: unitId }),
    unit: {
      ...(clusterId && { cluster_id: clusterId }),
      ...(campusId && { cluster: { campus_id: campusId } }),
    },
  };

  const [campus, cluster, unit, buildings, itemMeta] = await Promise.all([
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
    loadScoredItemMeta(),
  ]);
  if ((clusterId && !cluster) || (unitId && !unit)) return null;

  const reassessed = buildings.filter((b) => b.latest && b.previous);
  const ids = {
    current: buildings.flatMap((b) => (b.latest ? [b.latest.id] : [])),
    lflCurrent: reassessed.map((b) => b.latest!.id),
    lflPrevious: reassessed.map((b) => b.previous!.id),
  };
  const allAssessmentIds = [...ids.current, ...ids.lflPrevious];
  const rows =
    allAssessmentIds.length > 0
      ? await prisma.assessmentAnswerRow.findMany({
          where: {
            assessment_id: { in: allAssessmentIds },
            answer: { not: null },
          },
          select: {
            assessment_id: true,
            item_id: true,
            answer: true,
          },
        })
      : [];

  const facts: AnswerFact[] = [];
  for (const r of rows) {
    const meta = itemMeta.get(r.item_id);
    if (!meta || !r.answer) continue;
    facts.push({
      assessment_id: r.assessment_id,
      ...meta,
      answer: r.answer,
    });
  }

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
      unit: {
        select: {
          id: true,
          name: true,
          cluster: {
            select: { id: true, name: true, campus: { select: { id: true, name: true } } },
          },
        },
      },
      assessments: {
        orderBy: { ended_at: 'asc' },
        select: { ...scoredSelect, version: { select: { label: true } } },
      },
    },
  });
  if (!building || !inScope(caller.scope, building.unit.cluster.campus.id)) return null;

  return {
    building: {
      id: building.id,
      name: building.name,
      unit: { id: building.unit.id, name: building.unit.name },
      cluster: { id: building.unit.cluster.id, name: building.unit.cluster.name },
      campus: building.unit.cluster.campus,
    },
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
      building: {
        select: { unit: { select: { cluster: { select: { campus_id: true } } } } },
      },
      areas: { select: { area_type_id: true } },
      answers: { where: { answer: { not: null } }, select: { item_id: true, answer: true } },
    },
  });
  const rowA = rows.find((r) => r.id === a);
  const rowB = rows.find((r) => r.id === b);
  if (!rowA || !rowB || rowA.building_id !== rowB.building_id) return null;
  if (!inScope(caller.scope, rowA.building.unit.cluster.campus_id)) return null;

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
