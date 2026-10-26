import type { Prisma } from '@prisma/client';
import {
  itemLabel,
  type AssessmentRecord,
  type AssessmentTemplate,
  type BuildingScores,
  type PillarCode,
  type SafeAnswer,
  type ScoredAssessment,
} from './assessment-template';
import { scoresFromPillarRows } from './building-safety';
import { prisma } from './prisma';

// Loaders shared by the ERT and admin assessment actions: a checklist version as the app sees it,
// one submitted assessment as `AssessmentRecord`, and buildings with their latest two scores.
// Server only (they use Prisma): import them from server actions, never from components.

const VERSION_TTL_MS = 60_000;

type LoadedVersion = { status: string; template: AssessmentTemplate };
export type ScoredItemMeta = {
  section_code: string;
  section_order: number;
  section_title_en: string;
  section_title_fil: string;
  label: string;
  prompt_en: string;
  prompt_fil: string;
  pillar_code: PillarCode | null;
  safe_answer: SafeAnswer;
};

const versionCache = new Map<string, { expires: number; promise: Promise<LoadedVersion | null> }>();
let scoredItemMetaCache: { expires: number; promise: Promise<Map<string, ScoredItemMeta>> } | null =
  null;

/** Clears cached checklist versions and item metadata after any Super Admin template edit. */
export function clearVersionCache() {
  versionCache.clear();
  scoredItemMetaCache = null;
}

const versionSelect = {
  id: true,
  label: true,
  status: true,
  sections: {
    orderBy: { sort_order: 'asc' },
    select: {
      id: true,
      code: true,
      title_en: true,
      title_fil: true,
      area_type_id: true,
      items: {
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          section_id: true,
          parent_id: true,
          code: true,
          prompt_en: true,
          prompt_fil: true,
          note_en: true,
          note_fil: true,
          reference: true,
          is_scored: true,
          safe_answer: true,
          area_type_id: true,
          min_floors: true,
          flag_label: true,
          pillar: { select: { code: true } },
        },
      },
    },
  },
} satisfies Prisma.AssessmentTemplateVersionSelect;

async function fetchVersion(
  where: Prisma.AssessmentTemplateVersionWhereInput
): Promise<LoadedVersion | null> {
  const [version, areaTypes] = await Promise.all([
    prisma.assessmentTemplateVersion.findFirst({
      where,
      select: versionSelect,
      orderBy: { published_at: { sort: 'desc', nulls: 'last' } },
    }),
    prisma.buildingAreaType.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: { id: true, code: true, name_en: true, name_fil: true },
    }),
  ]);
  if (!version) return null;

  const template: AssessmentTemplate = {
    version_id: version.id,
    label: version.label,
    area_types: areaTypes,
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

export async function loadVersion(where: Prisma.AssessmentTemplateVersionWhereInput) {
  const key = JSON.stringify(where);
  const now = Date.now();
  const hit = versionCache.get(key);
  if (hit && hit.expires > now) return hit.promise;

  const promise = fetchVersion(where).catch((err) => {
    versionCache.delete(key);
    throw err;
  });
  versionCache.set(key, { expires: now + VERSION_TTL_MS, promise });
  return promise;
}

/** Cached lookup of scored checklist items by id so dashboard rollups don't join item/section/pillar text on every answer row. */
export async function loadScoredItemMeta(): Promise<Map<string, ScoredItemMeta>> {
  const now = Date.now();
  if (scoredItemMetaCache && scoredItemMetaCache.expires > now) {
    return scoredItemMetaCache.promise;
  }
  const promise = prisma.assessmentItem
    .findMany({
      where: { is_scored: true },
      select: {
        id: true,
        code: true,
        prompt_en: true,
        prompt_fil: true,
        safe_answer: true,
        pillar: { select: { code: true } },
        section: { select: { code: true, title_en: true, title_fil: true, sort_order: true } },
      },
    })
    .then(
      (rows) =>
        new Map(
          rows.map((r) => [
            r.id,
            {
              section_code: r.section.code,
              section_order: r.section.sort_order,
              section_title_en: r.section.title_en,
              section_title_fil: r.section.title_fil,
              label: itemLabel(r.section, r),
              prompt_en: r.prompt_en,
              prompt_fil: r.prompt_fil,
              pillar_code: (r.pillar?.code ?? null) as PillarCode | null,
              safe_answer: r.safe_answer,
            },
          ])
        )
    )
    .catch((err) => {
      scoredItemMetaCache = null;
      throw err;
    });
  scoredItemMetaCache = { expires: now + VERSION_TTL_MS, promise };
  return promise;
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
    select: {
      id: true,
      building_id: true,
      template_version_id: true,
      incident_commander: true,
      started_at: true,
      ended_at: true,
      floor_count: true,
      needs_follow_up: true,
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

export const scoredSelect = {
  id: true,
  ended_at: true,
  needs_follow_up: true,
  ...scoredInclude,
} satisfies Prisma.AssessmentSelect;

/** An assessment row loaded with `scoredSelect` or `scoredInclude`, as scores. */
export function toScoredAssessment(
  a: Prisma.AssessmentGetPayload<{ select: typeof scoredSelect }>
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
    select: {
      id: true,
      name: true,
      floor_count: true,
      unit: {
        select: {
          id: true,
          name: true,
          cluster: {
            select: { id: true, name: true, campus: { select: { id: true, name: true } } },
          },
        },
      },
      assessments: { orderBy: { ended_at: 'desc' }, take: 2, select: scoredSelect },
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
