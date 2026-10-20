import {
  PILLAR_CODES,
  type AnswerValue,
  type AssessmentTemplate,
  type PillarCode,
  type TemplateItem,
} from './assessment-template';

// Which questions apply to a building and how its answers score (spec Sections 3.3–3.4 and 4).
// Shared by the form (live progress and the review step) and the server, which re-checks every
// submitted assessment with prepareAssessmentWrite before saving it.

/** `safe`: answered with the item's safe answer. `counted`: answered yes or no. `na`: answered N/A. */
export interface Tally {
  safe: number;
  counted: number;
  na: number;
}

/** Answers by item id. */
export type AnswerMap = Record<string, AnswerValue | null | undefined>;

const emptyTally = (): Tally => ({ safe: 0, counted: 0, na: 0 });

const emptyPillars = () =>
  Object.fromEntries(PILLAR_CODES.map((p) => [p, emptyTally()])) as Record<PillarCode, Tally>;

function tallyAnswer(tally: Tally, item: TemplateItem, answer: AnswerValue) {
  if (answer === 'na') {
    tally.na += 1;
    return;
  }
  tally.counted += 1;
  if (answer === item.safe_answer) tally.safe += 1;
}

/** Items that apply, in template order. A group parent is included only when one of its sub-items applies. */
export function applicableItems(
  template: AssessmentTemplate,
  floors: number,
  areaTypeIds: Iterable<string>
): TemplateItem[] {
  const ticked = new Set(areaTypeIds);
  const open = (areaTypeId: string | null) => areaTypeId === null || ticked.has(areaTypeId);

  // A parent comes before its sub-items, so whether it applies is known by the time they're reached.
  const applies = new Set<string>();
  const items: TemplateItem[] = [];
  for (const section of template.sections) {
    if (!open(section.area_type_id)) continue;
    for (const item of section.items) {
      if (!open(item.area_type_id)) continue;
      if (item.min_floors !== null && floors < item.min_floors) continue;
      if (item.parent_id !== null && !applies.has(item.parent_id)) continue;
      applies.add(item.id);
      items.push(item);
    }
  }

  const withSubItems = new Set(items.map((i) => i.parent_id).filter((id) => id !== null));
  return items.filter((i) => i.is_scored || withSubItems.has(i.id));
}

/** Scored items gated by each area type (its section's area or its own), counting min_floors. Keyed by area type id. */
export function areaQuestionCounts(
  template: AssessmentTemplate,
  floors: number
): Record<string, number> {
  const counts = Object.fromEntries(template.area_types.map((a) => [a.id, 0]));
  for (const section of template.sections) {
    for (const item of section.items) {
      if (!item.is_scored) continue;
      if (item.min_floors !== null && floors < item.min_floors) continue;
      const gates = new Set([section.area_type_id, item.area_type_id]);
      for (const areaTypeId of gates) {
        if (areaTypeId !== null) counts[areaTypeId] = (counts[areaTypeId] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export interface AssessmentScore {
  overall: Tally;
  pillars: Record<PillarCode, Tally>;
  /** By section id; only sections with at least one applicable scored item. */
  sections: Record<string, Tally>;
  /** Applicable scored items without an answer, in template order. */
  unanswered: TemplateItem[];
  /** Counted items that aren't safe, in template order. */
  unsafe: TemplateItem[];
  /** Some unsafe item carries a flag (VI.1.x, visible wall cracks). */
  needsFollowUp: boolean;
}

export function scoreAssessment(
  template: AssessmentTemplate,
  floors: number,
  areaTypeIds: Iterable<string>,
  answers: AnswerMap
): AssessmentScore {
  const overall = emptyTally();
  const pillars = emptyPillars();
  const sections: Record<string, Tally> = {};
  const unanswered: TemplateItem[] = [];
  const unsafe: TemplateItem[] = [];

  for (const item of applicableItems(template, floors, areaTypeIds)) {
    if (!item.is_scored) continue;
    const section = (sections[item.section_id] ??= emptyTally());
    const answer = answers[item.id];
    if (!answer) {
      unanswered.push(item);
      continue;
    }
    tallyAnswer(overall, item, answer);
    tallyAnswer(section, item, answer);
    if (item.pillar_code) tallyAnswer(pillars[item.pillar_code], item, answer);
    if (answer !== 'na' && answer !== item.safe_answer) unsafe.push(item);
  }

  return {
    overall,
    pillars,
    sections,
    unanswered,
    unsafe,
    needsFollowUp: unsafe.some((i) => i.flag_label !== null),
  };
}

/** Share of counted answers that are safe, rounded; null when nothing was counted. */
export function percent(t: Tally): number | null {
  return t.counted === 0 ? null : Math.round((100 * t.safe) / t.counted);
}

/** Pillar 4 has one item, so it reads as In place / Missing / N/A rather than a percent. */
export function recoveryStatus(t: Tally): 'in_place' | 'missing' | 'na' {
  if (t.counted === 0) return 'na';
  return t.safe === t.counted ? 'in_place' : 'missing';
}

export interface WriteInput {
  floor_count: number;
  area_type_ids: string[];
  answers: { item_id: string; answer: AnswerValue | null; remarks: string | null }[];
  comments: { section_id: string; comment: string }[];
}

export interface PreparedAssessment {
  answers: WriteInput['answers'];
  comments: WriteInput['comments'];
  pillarTallies: Record<PillarCode, Tally>;
  needsFollowUp: boolean;
  /** Applicable scored items left unanswered. */
  missing: number;
}

/** Server-side: keep only applicable items (template order), null the answer on group parents, trim remarks ('' → null), drop empty rows and comments of sections that don't apply. */
export function prepareAssessmentWrite(
  template: AssessmentTemplate,
  input: WriteInput
): PreparedAssessment {
  const items = applicableItems(template, input.floor_count, input.area_type_ids);
  const submitted = new Map(input.answers.map((a) => [a.item_id, a]));

  const answers: WriteInput['answers'] = [];
  const answerMap: AnswerMap = {};
  for (const item of items) {
    const row = submitted.get(item.id);
    if (!row) continue;
    const answer = item.is_scored ? row.answer : null;
    const remarks = row.remarks?.trim() || null;
    if (answer === null && remarks === null) continue;
    answers.push({ item_id: item.id, answer, remarks });
    if (answer) answerMap[item.id] = answer;
  }

  const applicableSections = new Set(items.map((i) => i.section_id));
  const submittedComments = new Map(input.comments.map((c) => [c.section_id, c.comment.trim()]));
  const comments: WriteInput['comments'] = [];
  for (const section of template.sections) {
    const comment = submittedComments.get(section.id);
    if (comment && applicableSections.has(section.id)) {
      comments.push({ section_id: section.id, comment });
    }
  }

  const score = scoreAssessment(template, input.floor_count, input.area_type_ids, answerMap);
  return {
    answers,
    comments,
    pillarTallies: score.pillars,
    needsFollowUp: score.needsFollowUp,
    missing: score.unanswered.length,
  };
}
