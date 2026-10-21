'use server';

import { inScope } from '@/lib/admin-scope';
import {
  loadAssessmentRecord,
  loadBuildingScores,
  scoredInclude,
  toScoredAssessment,
} from '@/lib/assessment-records';
import { scoreAssessment, type AnswerMap } from '@/lib/assessment-score';
import { itemLabel, type AssessmentRecord, type PillarCode } from '@/lib/assessment-template';
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

  const [campus, cluster, unit] = await Promise.all([
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
  ]);
  if ((clusterId && !cluster) || (unitId && !unit)) return null;

  const where: Prisma.BuildingWhereInput = {
    is_active: true,
    ...(unitId && { unit_id: unitId }),
    unit: {
      ...(clusterId && { cluster_id: clusterId }),
      ...(campusId && { cluster: { campus_id: campusId } }),
    },
  };
  const buildings = await loadBuildingScores(where);

  const reassessed = buildings.filter((b) => b.latest && b.previous);
  const ids = {
    current: buildings.flatMap((b) => (b.latest ? [b.latest.id] : [])),
    lflCurrent: reassessed.map((b) => b.latest!.id),
    lflPrevious: reassessed.map((b) => b.previous!.id),
  };
  const rows = await prisma.assessmentAnswerRow.findMany({
    where: {
      assessment_id: { in: [...ids.current, ...ids.lflPrevious] },
      answer: { not: null },
      item: { is_scored: true },
    },
    select: {
      assessment_id: true,
      answer: true,
      item: {
        select: {
          code: true,
          prompt_en: true,
          prompt_fil: true,
          safe_answer: true,
          pillar: { select: { code: true } },
          section: { select: { code: true, title_en: true, title_fil: true, sort_order: true } },
        },
      },
    },
  });
  const facts: AnswerFact[] = rows.map((r) => ({
    assessment_id: r.assessment_id,
    section_code: r.item.section.code,
    section_order: r.item.section.sort_order,
    section_title_en: r.item.section.title_en,
    section_title_fil: r.item.section.title_fil,
    label: itemLabel(r.item.section, r.item),
    prompt_en: r.item.prompt_en,
    prompt_fil: r.item.prompt_fil,
    pillar_code: (r.item.pillar?.code ?? null) as PillarCode | null,
    answer: r.answer!,
    safe_answer: r.item.safe_answer,
  }));

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
    include: {
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
        include: { ...scoredInclude, version: { select: { label: true } } },
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

function scoreOf(record: AssessmentRecord) {
  const answers: AnswerMap = Object.fromEntries(
    Object.entries(record.answers).map(([itemId, a]) => [itemId, a.answer])
  );
  return scoreAssessment(record.template, record.floor_count, record.area_type_ids, answers);
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

  const [recordA, recordB] = await Promise.all([
    loadAssessmentRecord({ id: a }),
    loadAssessmentRecord({ id: b }),
  ]);
  if (!recordA || !recordB || recordA.building_id !== recordB.building_id) return null;
  if (!inScope(caller.scope, recordA.campus_id)) return null;

  return compareScores(
    { template: recordA.template, score: scoreOf(recordA) },
    { template: recordB.template, score: scoreOf(recordB) }
  );
}
