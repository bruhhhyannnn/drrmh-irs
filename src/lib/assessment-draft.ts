import { applicableItems } from './assessment-score';
import type {
  AnswerValue,
  AssessmentTemplate,
  BuildingOption,
  TemplateItem,
} from './assessment-template';
import type { AssessmentPayload } from './schemas';

// The assessment being filled in, kept on the phone (IndexedDB) until it's submitted. Answers stay
// in the draft when a floor count or area change makes them stop applying ("set aside"), so ticking
// the area again brings them back; only toPayload leaves them out.

export type DraftStep = 'details' | 'building' | `section:${string}` | 'review';

export interface DraftAnswer {
  answer?: AnswerValue;
  remarks?: string;
}

export interface AssessmentDraft {
  version: 1;
  client_ref: string;
  evaluator_id: string;
  campus_id: string;
  template_version_id: string;
  started_at: string;
  updated_at: number;
  cluster_id: string;
  unit_id: string;
  /** '' while adding a new building. */
  building_id: string;
  new_building_name: string;
  building_name: string;
  incident_commander: string;
  /** '' = none. */
  event_id: string;
  floor_count: number;
  area_type_ids: string[];
  /** ISO date of the building's last assessment, when its profile was taken from it. */
  prefilled_from: string | null;
  /** By item id, kept when set aside. */
  answers: Record<string, DraftAnswer>;
  /** By section id. */
  comments: Record<string, string>;
  step: DraftStep;
}

/** A v4 uuid. crypto.randomUUID only exists in secure contexts, so plain-http LAN dev falls back. */
export function newUuid(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newDraft(input: {
  client_ref: string;
  evaluator_id: string;
  campus_id: string;
  template_version_id: string;
  cluster_id: string;
  unit_id: string;
  now: Date;
}): AssessmentDraft {
  return {
    version: 1,
    client_ref: input.client_ref,
    evaluator_id: input.evaluator_id,
    campus_id: input.campus_id,
    template_version_id: input.template_version_id,
    started_at: input.now.toISOString(),
    updated_at: input.now.getTime(),
    cluster_id: input.cluster_id,
    unit_id: input.unit_id,
    building_id: '',
    new_building_name: '',
    building_name: '',
    incident_commander: '',
    event_id: '',
    floor_count: 1,
    area_type_ids: [],
    prefilled_from: null,
    answers: {},
    comments: {},
    step: 'details',
  };
}

/** A whole number of floors from 1 to 200. */
export function clampFloors(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(200, Math.max(1, Math.round(value)));
}

/** Floors as typed in the box: null while it's blank or not a number (not committed yet). */
export function parseFloors(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? clampFloors(value) : null;
}

/** Choosing a saved building takes its floors and areas from its last assessment; answers stay. */
export function applyBuildingProfile(
  draft: AssessmentDraft,
  building: BuildingOption
): AssessmentDraft {
  return {
    ...draft,
    building_id: building.id,
    building_name: building.name,
    new_building_name: '',
    floor_count: building.floor_count,
    area_type_ids: [...building.area_type_ids],
    prefilled_from: building.last_assessed_at,
  };
}

const remarksOf = (a: DraftAnswer | undefined) => a?.remarks?.trim() || null;
const hasContent = (a: DraftAnswer | undefined) => Boolean(a?.answer || remarksOf(a));

/** Answered items that apply now but would stop applying with `next`. */
export function setAsideCount(
  template: AssessmentTemplate,
  draft: AssessmentDraft,
  next: { floor_count: number; area_type_ids: string[] }
): number {
  const after = new Set(
    applicableItems(template, next.floor_count, next.area_type_ids).map((i) => i.id)
  );
  return applicableItems(template, draft.floor_count, draft.area_type_ids).filter(
    (i) => !after.has(i.id) && hasContent(draft.answers[i.id])
  ).length;
}

const applicable = (template: AssessmentTemplate, draft: AssessmentDraft): TemplateItem[] =>
  applicableItems(template, draft.floor_count, draft.area_type_ids);

/** Details, building, one step per section with something to ask (by section id), review. */
export function draftSteps(template: AssessmentTemplate, draft: AssessmentDraft): DraftStep[] {
  const sectionIds = new Set(applicable(template, draft).map((i) => i.section_id));
  return [
    'details',
    'building',
    ...template.sections
      .filter((s) => sectionIds.has(s.id))
      .map((s): DraftStep => `section:${s.id}`),
    'review',
  ];
}

/** Applicable scored items, answered and in all, by section id. */
export function sectionProgress(
  template: AssessmentTemplate,
  draft: AssessmentDraft
): Record<string, { answered: number; total: number }> {
  const progress: Record<string, { answered: number; total: number }> = {};
  for (const item of applicable(template, draft)) {
    if (!item.is_scored) continue;
    const section = (progress[item.section_id] ??= { answered: 0, total: 0 });
    section.total += 1;
    if (draft.answers[item.id]?.answer) section.answered += 1;
  }
  return progress;
}

/** What gets submitted (and queued): only what applies, in template order. */
export function toPayload(
  template: AssessmentTemplate,
  draft: AssessmentDraft,
  endedAt: Date
): AssessmentPayload {
  const items = applicable(template, draft);

  const answers: AssessmentPayload['answers'] = [];
  for (const item of items) {
    const row = draft.answers[item.id];
    const answer = item.is_scored ? (row?.answer ?? null) : null;
    const remarks = remarksOf(row);
    if (answer === null && remarks === null) continue;
    answers.push({ item_id: item.id, answer, remarks });
  }

  const sectionIds = new Set(items.map((i) => i.section_id));
  const comments: AssessmentPayload['comments'] = [];
  for (const section of template.sections) {
    const comment = draft.comments[section.id]?.trim();
    if (comment && sectionIds.has(section.id)) comments.push({ section_id: section.id, comment });
  }

  return {
    client_ref: draft.client_ref,
    evaluator_id: draft.evaluator_id,
    template_version_id: draft.template_version_id,
    building: draft.building_id
      ? { id: draft.building_id }
      : { new: { unit_id: draft.unit_id, name: draft.new_building_name.trim() } },
    event_id: draft.event_id || null,
    incident_commander: draft.incident_commander.trim(),
    floor_count: draft.floor_count,
    area_type_ids: [...draft.area_type_ids],
    started_at: draft.started_at,
    ended_at: endedAt.toISOString(),
    answers,
    comments,
  };
}

/**
 * A queued assessment turned back into a draft, so one the server refused can be fixed and
 * sent again (same client_ref). The payload doesn't carry the campus, the cluster, or the unit
 * and name of an existing building; the caller looks those up. Opens on the review step.
 */
export function draftFromPayload(
  payload: AssessmentPayload,
  extras: {
    campus_id: string;
    cluster_id: string;
    unit_id: string;
    building_name: string;
    now: Date;
  }
): AssessmentDraft {
  return {
    version: 1,
    client_ref: payload.client_ref,
    evaluator_id: payload.evaluator_id,
    campus_id: extras.campus_id,
    template_version_id: payload.template_version_id,
    started_at: payload.started_at,
    updated_at: extras.now.getTime(),
    cluster_id: extras.cluster_id,
    unit_id: 'new' in payload.building ? payload.building.new.unit_id : extras.unit_id,
    building_id: 'id' in payload.building ? payload.building.id : '',
    new_building_name: 'new' in payload.building ? payload.building.new.name : '',
    building_name: 'new' in payload.building ? '' : extras.building_name,
    incident_commander: payload.incident_commander,
    event_id: payload.event_id ?? '',
    floor_count: payload.floor_count,
    area_type_ids: [...payload.area_type_ids],
    prefilled_from: null,
    answers: Object.fromEntries(
      payload.answers.map((a) => [
        a.item_id,
        {
          ...(a.answer ? { answer: a.answer } : {}),
          ...(a.remarks ? { remarks: a.remarks } : {}),
        },
      ])
    ),
    comments: Object.fromEntries(payload.comments.map((c) => [c.section_id, c.comment])),
    step: 'review',
  };
}
