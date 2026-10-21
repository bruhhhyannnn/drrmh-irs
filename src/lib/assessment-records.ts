import type { Prisma } from '@prisma/client';
import {
  type AssessmentRecord,
  type AssessmentTemplate,
  type BuildingScores,
  type PillarCode,
  type ScoredAssessment,
} from './assessment-template';
import { scoresFromPillarRows } from './building-safety';
import { prisma } from './prisma';

// Loaders shared by the ERT and admin assessment actions: a checklist version as the app sees it,
// one submitted assessment as `AssessmentRecord`, and buildings with their latest two scores.
// Server only (they use Prisma): import them from server actions, never from components.

const versionInclude = {
  sections: {
    orderBy: { sort_order: 'asc' },
    include: {
      items: { orderBy: { sort_order: 'asc' }, include: { pillar: { select: { code: true } } } },
    },
  },
} satisfies Prisma.AssessmentTemplateVersionInclude;

export async function loadVersion(where: Prisma.AssessmentTemplateVersionWhereInput) {
  const [version, areaTypes] = await Promise.all([
    prisma.assessmentTemplateVersion.findFirst({
      where,
      include: versionInclude,
      orderBy: { published_at: { sort: 'desc', nulls: 'last' } },
    }),
    prisma.buildingAreaType.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    }),
  ]);
  if (!version) return null;

  const template: AssessmentTemplate = {
    version_id: version.id,
    label: version.label,
    area_types: areaTypes.map((a) => ({
      id: a.id,
      code: a.code,
      name_en: a.name_en,
      name_fil: a.name_fil,
    })),
    sections: version.sections.map((s) => ({
      id: s.id,
      code: s.code,
      title_en: s.title_en,
      title_fil: s.title_fil,
      area_type_id: s.area_type_id,
      items: s.items.map((i) => ({
        id: i.id,
        section_id: i.section_id,
        parent_id: i.parent_id,
        code: i.code,
        prompt_en: i.prompt_en,
        prompt_fil: i.prompt_fil,
        note_en: i.note_en,
        note_fil: i.note_fil,
        reference: i.reference,
        is_scored: i.is_scored,
        safe_answer: i.safe_answer,
        area_type_id: i.area_type_id,
        min_floors: i.min_floors,
        flag_label: i.flag_label,
        pillar_code: (i.pillar?.code ?? null) as PillarCode | null,
      })),
    })),
  };
  return { status: version.status, template };
}

const personName = (p: { first_name: string | null; last_name: string | null }) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ');

/** One submitted assessment with the version it was answered with; null when not found. The
 * caller decides who may see it through `where`. */
export async function loadAssessmentRecord(
  where: Prisma.AssessmentWhereInput
): Promise<(AssessmentRecord & { campus_id: string; building_id: string }) | null> {
  const a = await prisma.assessment.findFirst({
    where,
    include: {
      building: {
        select: {
          name: true,
          unit: {
            select: {
              name: true,
              cluster: {
                select: { name: true, campus_id: true, campus: { select: { name: true } } },
              },
            },
          },
        },
      },
      evaluator: { select: { first_name: true, last_name: true } },
      event: { select: { name: true } },
      areas: { select: { area_type_id: true } },
      answers: { select: { item_id: true, answer: true, remarks: true } },
      comments: { select: { section_id: true, comment: true } },
    },
  });
  if (!a) return null;
  const version = await loadVersion({ id: a.template_version_id });
  if (!version) return null;

  return {
    id: a.id,
    building_id: a.building_id,
    campus_id: a.building.unit.cluster.campus_id,
    building_name: a.building.name,
    unit_name: a.building.unit.name,
    cluster_name: a.building.unit.cluster.name,
    campus_name: a.building.unit.cluster.campus.name,
    evaluator_name: personName(a.evaluator),
    incident_commander: a.incident_commander,
    event_name: a.event?.name ?? null,
    started_at: a.started_at.toISOString(),
    ended_at: a.ended_at.toISOString(),
    floor_count: a.floor_count,
    area_type_ids: a.areas.map((r) => r.area_type_id),
    needs_follow_up: a.needs_follow_up,
    answers: Object.fromEntries(
      a.answers.map((r) => [r.item_id, { answer: r.answer, remarks: r.remarks }])
    ),
    comments: Object.fromEntries(a.comments.map((c) => [c.section_id, c.comment])),
    template: version.template,
  };
}

export const scoredInclude = {
  pillar_scores: {
    select: {
      safe_count: true,
      counted_count: true,
      na_count: true,
      pillar: { select: { code: true } },
    },
  },
  evaluator: { select: { first_name: true, last_name: true } },
  event: { select: { name: true } },
} satisfies Prisma.AssessmentInclude;

/** An assessment row loaded with `scoredInclude`, as scores. */
export function toScoredAssessment(
  a: Prisma.AssessmentGetPayload<{ include: typeof scoredInclude }>
): ScoredAssessment {
  return {
    id: a.id,
    ended_at: a.ended_at.toISOString(),
    evaluator_name: personName(a.evaluator),
    needs_follow_up: a.needs_follow_up,
    event_name: a.event?.name ?? null,
    ...scoresFromPillarRows(a.pillar_scores.map((p) => ({ ...p, code: p.pillar.code }))),
  };
}

/** Buildings by name, each with its latest assessment and the one before it. */
export async function loadBuildingScores(
  where: Prisma.BuildingWhereInput
): Promise<BuildingScores[]> {
  const buildings = await prisma.building.findMany({
    where,
    orderBy: { name: 'asc' },
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
      assessments: { orderBy: { ended_at: 'desc' }, take: 2, include: scoredInclude },
      _count: { select: { assessments: true } },
    },
  });
  return buildings.map((b) => ({
    id: b.id,
    name: b.name,
    floor_count: b.floor_count,
    unit: { id: b.unit.id, name: b.unit.name },
    cluster: { id: b.unit.cluster.id, name: b.unit.cluster.name },
    campus: b.unit.cluster.campus,
    assessment_count: b._count.assessments,
    latest: b.assessments[0] ? toScoredAssessment(b.assessments[0]) : null,
    previous: b.assessments[1] ? toScoredAssessment(b.assessments[1]) : null,
  }));
}
