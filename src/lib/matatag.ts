import checklist from './matatag-checklist.json';
import {
  defaultMatatagTemplate,
  type MatatagQuestion,
  type MatatagTemplate,
} from './matatag-template';

export const MATATAG_VERSION = '2026-06-29';
export const MATATAG_PHASES = ['PRE', 'POST'] as const;
export type MatatagPhase = (typeof MATATAG_PHASES)[number];
export const matatagSections = checklist;
export const matatagItems = checklist.flatMap((section) =>
  section.items.filter((item) => !item.group)
);
export type MatatagAnswer = string;
export type MatatagDocument = {
  version: string;
  template?: MatatagTemplate;
  details: {
    phase: MatatagPhase;
    campusId: string;
    campus: string;
    unit: string;
    buildings: string;
    buildingCount: string;
    floorCount: string;
    commander: string;
    evaluator: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    overallScore: string;
  };
  answers: Record<string, MatatagAnswer>;
  remarks: Record<string, string>;
  sections: Record<string, { notApplicable: boolean; score: string; comments: string }>;
};

export function emptyMatatag(
  published?: {
    id: string;
    definition: MatatagTemplate;
  },
  phase: MatatagPhase = 'PRE'
): MatatagDocument {
  return {
    version: published?.id ?? MATATAG_VERSION,
    ...(published ? { template: published.definition } : {}),
    details: {
      phase,
      campusId: '',
      campus: '',
      unit: '',
      buildings: '',
      buildingCount: '',
      floorCount: '',
      commander: '',
      evaluator: '',
      date: '',
      timeStart: '',
      timeEnd: '',
      overallScore: '',
    },
    answers: {},
    remarks: {},
    sections: {},
  };
}

export function effectiveAnswer(document: MatatagDocument, sectionId: string, itemId: string) {
  const unit = findUnit(document, sectionId, itemId);
  if (unit?.item.group) return unitKind(document, sectionId, unit);
  return document.sections[sectionId]?.notApplicable ? 'NA' : document.answers[itemId];
}

export function assessmentSections(document: MatatagDocument) {
  return (document.template ?? defaultMatatagTemplate).sections;
}

type MatatagSection = MatatagTemplate['sections'][number];
type MatatagQuestionUnit = { item: MatatagQuestion; children: MatatagQuestion[] };
export type MatatagUnansweredQuestion = {
  sectionId: string;
  itemId: string;
  number: string;
};

export function matatagQuestionUnits(section: MatatagSection): MatatagQuestionUnit[] {
  const units: MatatagQuestionUnit[] = [];
  let group: MatatagQuestionUnit | undefined;
  for (const item of section.items) {
    if (item.group) {
      group = { item, children: [] };
      units.push(group);
    } else if (group && item.number.startsWith(`${group.item.number}.`)) {
      group.children.push(item);
    } else {
      group = undefined;
      units.push({ item, children: [] });
    }
  }
  return units;
}

function answerKind(document: MatatagDocument, sectionId: string, item: MatatagQuestion) {
  return document.sections[sectionId]?.notApplicable
    ? 'NA'
    : item.options.find((option) => option.value === document.answers[item.id])?.kind;
}

function unitKind(
  document: MatatagDocument,
  sectionId: string,
  unit: MatatagQuestionUnit
): 'YES' | 'NO' | 'NA' | undefined {
  if (document.sections[sectionId]?.notApplicable) return 'NA';
  if (!unit.item.group) return answerKind(document, sectionId, unit.item);
  const kinds = unit.children.map((item) => answerKind(document, sectionId, item));
  if (!kinds.length || kinds.some((kind) => !kind)) return undefined;
  if (kinds.includes('NO')) return 'NO';
  if (kinds.every((kind) => kind === 'NA')) return 'NA';
  return 'YES';
}

function findUnit(document: MatatagDocument, sectionId: string, itemId: string) {
  const section = assessmentSections(document).find((entry) => entry.id === sectionId);
  return section?.items.some((item) => item.id === itemId)
    ? matatagQuestionUnits(section).find(
        (unit) => unit.item.id === itemId || unit.children.some((item) => item.id === itemId)
      )
    : undefined;
}

export function matatagAnswerLabel(
  document: MatatagDocument,
  sectionId: string,
  item: MatatagQuestion,
  language: 'en' | 'fil' | 'both'
) {
  const unit = findUnit(document, sectionId, item.id);
  const kind = unit ? unitKind(document, sectionId, unit) : answerKind(document, sectionId, item);
  if (!kind) return 'Unanswered';
  const option =
    item.options?.find((o) => o.value === document.answers[item.id]) ??
    unit?.children.flatMap((child) => child.options).find((o) => o.kind === kind);
  if (!option)
    return language === 'fil'
      ? { YES: 'Oo', NO: 'Hindi', NA: 'N/A' }[kind]
      : kind === 'NA'
        ? 'N/A'
        : kind === 'YES'
          ? 'Yes'
          : 'No';
  return language === 'fil' ? option.fil || option.en : option.en;
}

export function matatagTotals(document: MatatagDocument, sectionId?: string) {
  const totals = { YES: 0, NO: 0, NA: 0, unanswered: 0, total: 0 };
  for (const section of assessmentSections(document).filter(
    (s) => !sectionId || s.id === sectionId
  )) {
    for (const unit of matatagQuestionUnits(section)) {
      const answer = unitKind(document, section.id, unit);
      if (answer) totals[answer]++;
      else totals.unanswered++;
      totals.total++;
    }
  }
  return totals;
}

export function matatagResponseTotals(document: MatatagDocument, sectionId?: string) {
  const totals = { YES: 0, NO: 0, NA: 0, unanswered: 0, total: 0 };
  for (const section of assessmentSections(document).filter(
    (s) => !sectionId || s.id === sectionId
  )) {
    for (const item of section.items.filter((item) => !item.group)) {
      const answer = answerKind(document, section.id, item);
      if (answer) totals[answer]++;
      else totals.unanswered++;
      totals.total++;
    }
  }
  return totals;
}

export function matatagUnansweredQuestions(document: MatatagDocument) {
  return assessmentSections(document).flatMap((section) =>
    matatagQuestionUnits(section).flatMap((unit) => {
      const items = unit.item.group ? unit.children : [unit.item];
      return items
        .filter((item) => !answerKind(document, section.id, item))
        .map((item): MatatagUnansweredQuestion => ({
          sectionId: section.id,
          itemId: item.id,
          number: item.number,
        }));
    })
  );
}

/**
 * Calculate the source form's score rule.
 * Positive items earn one point on YES. Starred negative items earn one point on NO.
 * Every answered YES, NO, or N/A response is included in the denominator.
 */
export function matatagScore(document: MatatagDocument, sectionId?: string) {
  let earned = 0;
  let answered = 0;
  for (const section of assessmentSections(document).filter(
    (s) => !sectionId || s.id === sectionId
  )) {
    for (const unit of matatagQuestionUnits(section)) {
      const answer = unitKind(document, section.id, unit);
      if (!answer) continue;
      answered++;
      if ((!unit.item.starred && answer === 'YES') || (unit.item.starred && answer === 'NO'))
        earned++;
    }
  }
  return answered ? `${Math.round((earned / answered) * 100)}%` : '—';
}

/** Persist a canonical score snapshot even if an imported draft contains stale score text. */
export function withCalculatedScores(document: MatatagDocument): MatatagDocument {
  return {
    ...document,
    details: { ...document.details, overallScore: matatagScore(document) },
    sections: Object.fromEntries(
      assessmentSections(document).map((section) => [
        section.id,
        {
          ...(document.sections[section.id] ?? { notApplicable: false, score: '', comments: '' }),
          score: matatagScore(document, section.id),
        },
      ])
    ),
  };
}

export function matatagCompletionErrors(document: MatatagDocument) {
  const required: [keyof MatatagDocument['details'], string][] = [
    ['campusId', 'Campus'],
    ['unit', 'College / department / unit'],
    ['buildings', 'Building name'],
    ['buildingCount', 'Number of buildings'],
    ['floorCount', 'Number of floors'],
    ['commander', 'Incident commander'],
    ['evaluator', 'Evaluator'],
    ['date', 'Assessment date'],
    ['timeStart', 'Start time'],
    ['timeEnd', 'End time'],
  ];
  const errors = required
    .filter(([key]) => !document.details[key].trim())
    .map(([, label]) => `${label} is required.`);
  const unanswered = matatagUnansweredQuestions(document);
  if (unanswered.length) {
    const noun = unanswered.length === 1 ? 'question' : 'questions';
    const verb = unanswered.length === 1 ? 'needs' : 'need';
    errors.push(
      `${unanswered.length} checklist ${noun} still ${verb} a response. Use N/A for questions or sections that do not apply.`
    );
  }
  return errors;
}
