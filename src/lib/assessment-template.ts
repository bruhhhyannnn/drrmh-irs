// The MATATAG checklist (and any later template) as the app sees it. The question bank is
// versioned in the database (assessment_templates → versions → sections → items); the server
// actions in src/actions/assessments map it to `AssessmentTemplate`, which the form, the scoring
// in assessment-score.ts and the offline cache all share. The checklist itself is seeded from
// typed data in prisma/data (`ChecklistData`).

import type { Tally } from './assessment-score';

/** Kinds of area a building can have, in pre-screen order. */
export const AREA_CODES = [
  'corridors',
  'bathrooms',
  'offices',
  'classrooms',
  'laboratories',
  'athletic',
  'dormitories',
  'playground',
  'swimming_pool',
  'stairwells',
] as const;
export type AreaCode = (typeof AREA_CODES)[number];

/** The four DRRM pillars, the same slugs (and order) as PILLARS in src/lib/pillars.ts. */
export const PILLAR_CODES = [
  'prevention-mitigation',
  'preparedness',
  'response',
  'rehabilitation-recovery',
] as const;
export type PillarCode = (typeof PILLAR_CODES)[number];

export type AnswerValue = 'yes' | 'no' | 'na';
export type SafeAnswer = 'yes' | 'no';
export type VersionStatus = 'draft' | 'published' | 'retired';

/** Raised when a VI.1.x item (visible wall cracks) gets its unsafe answer. */
export const STRUCTURAL_FLAG = 'Needs structural follow-up';

/* ─── Source data (prisma/data): codes, no ids ─── */

/** One question. An item with `items` is a group parent: it holds the shared prompt, its
 * sub-items are the scored ones. */
export interface ChecklistItemData {
  code: string;
  en: string;
  fil: string;
  reference?: string;
  /** Required on scored items. */
  pillar?: PillarCode;
  area?: AreaCode;
  /** Reverse-scored: NO is the safe answer. */
  safe?: 'no';
  minFloors?: number;
  flag?: string;
  items?: ChecklistItemData[];
}

export interface ChecklistSectionData {
  code: string;
  en: string;
  fil: string;
  /** The whole section needs this area. */
  area?: AreaCode;
  items: ChecklistItemData[];
}

export interface ChecklistData {
  template: { code: string; name: string; description: string };
  versionLabel: string;
  areaTypes: { code: AreaCode; en: string; fil: string }[];
  sections: ChecklistSectionData[];
}

/* ─── The template as the app uses it ─── */

export interface TemplateAreaType {
  id: string;
  code: string;
  name_en: string;
  name_fil: string;
}

export interface TemplateItem {
  id: string;
  section_id: string;
  parent_id: string | null;
  code: string;
  prompt_en: string;
  prompt_fil: string;
  note_en: string | null;
  note_fil: string | null;
  reference: string | null;
  is_scored: boolean;
  safe_answer: SafeAnswer;
  area_type_id: string | null;
  min_floors: number | null;
  flag_label: string | null;
  pillar_code: PillarCode | null;
}

/** `items` are flat, in sort order, each group parent right before its sub-items. */
export interface TemplateSection {
  id: string;
  code: string;
  title_en: string;
  title_fil: string;
  area_type_id: string | null;
  items: TemplateItem[];
}

export interface AssessmentTemplate {
  version_id: string;
  label: string;
  area_types: TemplateAreaType[];
  sections: TemplateSection[];
}

/** A saved building to choose on the Details step, with the profile its last assessment left. */
export interface BuildingOption {
  id: string;
  unit_id: string;
  name: string;
  floor_count: number;
  area_type_ids: string[];
  last_assessed_at: string | null;
}

/* ─── What the server actions return (dates as ISO strings) ─── */

export interface AssessmentSetup {
  /** Active clusters of the campus with their active units, by name. */
  clusters: { id: string; name: string; units: { id: string; name: string }[] }[];
  /** Active buildings of the campus. */
  buildings: BuildingOption[];
  /** Ongoing, or completed with ended_at in the last 30 days. */
  events: { id: string; name: string; status: string }[];
}

export type CreateAssessmentResult =
  { ok: true; id: string } | { ok: false; error: string; retry: boolean };

export interface MyAssessmentRow {
  id: string;
  building_name: string;
  unit_name: string;
  ended_at: string;
  safe: number;
  counted: number;
  needs_follow_up: boolean;
}

export interface AssessmentRecord {
  id: string;
  building_name: string;
  unit_name: string;
  cluster_name: string;
  campus_name: string;
  evaluator_name: string;
  incident_commander: string;
  event_name: string | null;
  started_at: string;
  ended_at: string;
  floor_count: number;
  area_type_ids: string[];
  needs_follow_up: boolean;
  /** By item id. */
  answers: Record<string, { answer: AnswerValue | null; remarks: string | null }>;
  /** By section id. */
  comments: Record<string, string>;
  /** The version it was answered with. */
  template: AssessmentTemplate;
}

/* ─── Admin reads (Phase 2) ─── */

export interface Named {
  id: string;
  name: string;
}

/** One submitted assessment's scores, from its stored pillar rows. */
export interface ScoredAssessment {
  id: string;
  ended_at: string;
  evaluator_name: string;
  needs_follow_up: boolean;
  event_name: string | null;
  overall: Tally;
  pillars: Record<PillarCode, Tally>;
}

/** A building with its latest assessment and the one before it. */
export interface BuildingScores {
  id: string;
  name: string;
  floor_count: number;
  unit: Named;
  cluster: Named;
  campus: Named;
  assessment_count: number;
  latest: ScoredAssessment | null;
  previous: ScoredAssessment | null;
}

export interface AdminAssessmentRow {
  id: string;
  building: Named;
  unit: Named;
  cluster: Named;
  campus: Named;
  evaluator_name: string;
  event_name: string | null;
  ended_at: string;
  overall: Tally;
  needs_follow_up: boolean;
}

/* ─── Checklist editor (Phase 3) ─── */

export interface TemplateVersionSummary {
  id: string;
  label: string;
  status: VersionStatus;
  published_at: string | null;
  created_at: string;
  assessment_count: number;
}

export interface EditableAreaType extends TemplateAreaType {
  sort_order: number;
  is_active: boolean;
}

export interface ChecklistEditorData {
  versions: TemplateVersionSummary[];
  area_types: EditableAreaType[];
  version: (AssessmentTemplate & { status: VersionStatus; assessment_count: number }) | null;
}

export type TemplateActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** Scored questions per DRRM pillar across the template's sections. */
export function pillarItemCounts(
  sections: readonly { items: readonly { is_scored: boolean; pillar_code: PillarCode | null }[] }[]
): Record<PillarCode, number> {
  const counts = Object.fromEntries(PILLAR_CODES.map((p) => [p, 0])) as Record<PillarCode, number>;
  for (const s of sections) {
    for (const i of s.items) {
      if (i.is_scored && i.pillar_code) counts[i.pillar_code] = (counts[i.pillar_code] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Keeps a section's items flat in tree order: top-level items in `sort_order`, each followed
 * immediately by its sub-items in `sort_order`, re-numbered 0…n-1.
 */
export function orderSectionItems<
  T extends { id: string; parent_id: string | null; sort_order: number },
>(items: readonly T[]): T[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const top = sorted.filter((i) => i.parent_id === null);
  const byParent = new Map<string, T[]>();
  for (const i of sorted) {
    if (i.parent_id === null) continue;
    const list = byParent.get(i.parent_id) ?? [];
    list.push(i);
    byParent.set(i.parent_id, list);
  }
  return top
    .flatMap((t) => [t, ...(byParent.get(t.id) ?? [])])
    .map((item, sort_order) => ({ ...item, sort_order }));
}

/** Moves a top-level item (with its sub-items) or a sub-item (within its parent) up or down. */
export function moveItemInSection<
  T extends { id: string; parent_id: string | null; sort_order: number },
>(items: readonly T[], itemId: string, direction: 'up' | 'down'): T[] {
  const ordered = orderSectionItems(items);
  const target = ordered.find((i) => i.id === itemId);
  if (!target) return ordered;
  const siblings = ordered.filter((i) => i.parent_id === target.parent_id);
  const idx = siblings.findIndex((i) => i.id === itemId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return ordered;

  const swapped = [...siblings];
  [swapped[idx], swapped[swapIdx]] = [swapped[swapIdx], swapped[idx]];
  const siblingOrder = new Map(swapped.map((s, k) => [s.id, k]));
  return orderSectionItems(
    ordered.map((i) => (siblingOrder.has(i.id) ? { ...i, sort_order: siblingOrder.get(i.id)! } : i))
  );
}

/** Checks that a draft version has at least one scored question and every scored question has a pillar. */
export function canPublishTemplate(
  sections: readonly {
    code: string;
    items: readonly { code: string; is_scored: boolean; pillar_code: PillarCode | null }[];
  }[]
): { ok: true } | { ok: false; error: string } {
  let scored = 0;
  for (const s of sections) {
    for (const i of s.items) {
      if (!i.is_scored) continue;
      scored += 1;
      if (!i.pillar_code) {
        return {
          ok: false,
          error: `${itemLabel(s, i)} needs a DRRM pillar before this version can be published.`,
        };
      }
    }
  }
  if (scored === 0) {
    return { ok: false, error: 'Add at least one scored question before publishing.' };
  }
  return { ok: true };
}

/** "III.4.1": the section code, then the item code. How the paper form names an item. */
export function itemLabel(section: { code: string }, item: { code: string }) {
  return `${section.code}.${item.code}`;
}

/**
 * The template built straight from checklist data, without a database: ids are code paths
 * ("III", "III/4", "III/4.1"), area type ids are the area codes and the version id is "data".
 * Used by the tests, which check the logic against the real checklist.
 */
export function templateFromData(data: ChecklistData): AssessmentTemplate {
  return {
    version_id: 'data',
    label: data.versionLabel,
    area_types: data.areaTypes.map((a) => ({
      id: a.code,
      code: a.code,
      name_en: a.en,
      name_fil: a.fil,
    })),
    sections: data.sections.map((section) => {
      const items: TemplateItem[] = [];
      const walk = (list: ChecklistItemData[], parentId: string | null) => {
        for (const item of list) {
          const id = `${section.code}/${item.code}`;
          items.push({
            id,
            section_id: section.code,
            parent_id: parentId,
            code: item.code,
            prompt_en: item.en,
            prompt_fil: item.fil,
            note_en: null,
            note_fil: null,
            reference: item.reference ?? null,
            is_scored: !item.items,
            safe_answer: item.safe ?? 'yes',
            area_type_id: item.area ?? null,
            min_floors: item.minFloors ?? null,
            flag_label: item.flag ?? null,
            pillar_code: item.pillar ?? null,
          });
          if (item.items) walk(item.items, id);
        }
      };
      walk(section.items, null);
      return {
        id: section.code,
        code: section.code,
        title_en: section.en,
        title_fil: section.fil,
        area_type_id: section.area ?? null,
        items,
      };
    }),
  };
}
