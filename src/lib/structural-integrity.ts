import type { AnswerValue } from './assessment-template';

// The structural integrity part of a building assessment (DRRM-044): the Rapid Condition
// Assessment Tool (RCAsT), Material Component, by Orozco et al. (UP Diliman Institute of Civil
// Engineering, form revised 3/5/13). Ten defect types are checked on four building elements. A
// defect that is present is graded by how bad it is (K2) and how widespread it is (K3), and the
// tool's formula turns that into a condition rating per element (LCR) and for the building (GCR).
// A higher rating means more deterioration, the opposite of the MATATAG safe-answer percent.
//
// The tool is a fixed instrument with its own formula, so its questions live here as data and not
// in the versioned checklist template (decision 0011). Shared by the form, the server (which
// re-checks every submit with prepareStructuralWrite) and the tests.

export const STRUCTURAL_TOOL_VERSION = 'RCAsT-Material-2013-03-05';

/** Above this condition rating (percent) the tool recommends a detailed investigation. */
export const STRUCTURAL_THRESHOLD = 15;

/** A grade from the tool's four-step scales, lowest first. */
export type Level = 1 | 2 | 3 | 4;
const LEVELS: readonly Level[] = [1, 2, 3, 4];

/** The tool's K2 (intensity) and K3 (extent) values for levels 1 to 4. */
const FACTOR_VALUES: Record<Level, number> = { 1: 0.5, 2: 1, 3: 1.5, 4: 2 };

/**
 * K4, the urgency of intervention. It is an engineer's judgement (when the repair is due), so ERT
 * members aren't asked for it: it stays at 1, the value the form itself uses for its maximum.
 */
const URGENCY_FACTOR = 1;

export interface Wording {
  en: string;
  fil: string;
}

/* ─── Elements ─── */

export const STRUCTURAL_ELEMENT_CODES = ['columns', 'beams', 'slabs', 'walls'] as const;
export type StructuralElement = (typeof STRUCTURAL_ELEMENT_CODES)[number];

/** Elements the form has a critical-crack check for. */
export const CRITICAL_ELEMENT_CODES = ['columns', 'beams', 'walls'] as const;
export type CriticalElement = (typeof CRITICAL_ELEMENT_CODES)[number];

export interface ElementInfo {
  code: StructuralElement;
  title: Wording;
  /** "column", for "Only one column". */
  one: Wording;
  /** K1: how much the element counts in the building's rating (Table A2). Walls don't count. */
  factor: number;
  /** The crack that makes this element critical (the form's footnote). */
  critical: Wording | null;
}

export const STRUCTURAL_ELEMENTS: readonly ElementInfo[] = [
  {
    code: 'columns',
    title: { en: 'Columns', fil: 'Mga haligi (poste)' },
    one: { en: 'column', fil: 'haligi' },
    factor: 1.2,
    critical: {
      en: 'Are there cracks running lengthwise, up and down the column?',
      fil: 'May mga bitak bang pahaba, pataas-pababa sa haligi?',
    },
  },
  {
    code: 'beams',
    title: { en: 'Beams', fil: 'Mga biga' },
    one: { en: 'beam', fil: 'biga' },
    factor: 1.1,
    critical: {
      en: 'Are there cracks running across the beam at the middle of its span?',
      fil: 'May mga bitak bang pahalang sa gitna ng biga?',
    },
  },
  {
    code: 'slabs',
    title: { en: 'Floor slabs', fil: 'Mga sahig (slab)' },
    one: { en: 'floor slab', fil: 'sahig' },
    factor: 0.3,
    critical: null,
  },
  {
    code: 'walls',
    title: { en: 'Walls', fil: 'Mga pader' },
    one: { en: 'wall', fil: 'pader' },
    factor: 0,
    critical: {
      en: 'Are there diagonal cracks?',
      fil: 'May mga pahilis na bitak ba?',
    },
  },
];

export function elementInfo(code: StructuralElement): ElementInfo {
  return STRUCTURAL_ELEMENTS.find((e) => e.code === code)!;
}

/* ─── Defects (the form's rows 1.1 to 2.2, with Table A4) ─── */

type FourWordings = readonly [Wording, Wording, Wording, Wording];

/** Table A3, for the defects Table A4 grades by "general criteria". */
const GENERAL_SEVERITY: FourWordings = [
  { en: 'Small, in one spot', fil: 'Maliit, sa iisang bahagi' },
  {
    en: 'Medium in one spot, or small in a few spots (under 1/4 of the member)',
    fil: 'Katamtaman sa iisang bahagi, o maliit sa ilang bahagi (wala pang 1/4)',
  },
  {
    en: 'Large, in many spots (1/4 to 3/4 of the member)',
    fil: 'Malaki, sa maraming bahagi (1/4 hanggang 3/4)',
  },
  { en: 'Very large, over most of the member', fil: 'Napakalaki, sa halos kabuuan' },
];

export interface DefectInfo {
  /** The form's row number. */
  code: string;
  /** The form's own name for the row. */
  term: string;
  /** B1: the basic value of the damage type. */
  weight: number;
  prompt: Wording;
  /** "How bad?", lowest first (K2 = 0.5, 1, 1.5, 2). */
  severity: FourWordings;
}

export const STRUCTURAL_DEFECTS: readonly DefectInfo[] = [
  {
    code: '1.1',
    term: 'Poor workmanship: peeling, stratification, honeycomb, voids',
    weight: 1,
    prompt: {
      en: 'Is the concrete surface peeling, layered, or full of holes?',
      fil: 'Ang ibabaw ba ng kongkreto ay nagbabalat, patong-patong, o maraming butas?',
    },
    severity: [
      { en: 'One small defect', fil: 'Isang maliit na depekto' },
      { en: 'Several small defects', fil: 'Ilang maliliit na depekto' },
      { en: 'A few larger defects', fil: 'Kaunting mas malalaking depekto' },
      { en: 'Several larger defects', fil: 'Maraming mas malalaking depekto' },
    ],
  },
  {
    code: '1.2',
    term: 'Cracking caused by direct loading, imposed deformation and restraint',
    weight: 3,
    prompt: { en: 'Are there cracks?', fil: 'May mga bitak ba?' },
    severity: [
      { en: 'One crack thinner than 0.5 mm', fil: 'Isang bitak na mas manipis sa 0.5 mm' },
      { en: 'Several cracks thinner than 0.5 mm', fil: 'Ilang bitak na mas manipis sa 0.5 mm' },
      { en: 'One crack wider than 0.5 mm', fil: 'Isang bitak na mas malapad sa 0.5 mm' },
      { en: 'Several cracks wider than 0.5 mm', fil: 'Ilang bitak na mas malapad sa 0.5 mm' },
    ],
  },
  {
    code: '1.3',
    term: 'Efflorescence, exudation and popout',
    weight: 1,
    prompt: {
      en: 'Are there white powdery deposits, seepage stains, or small pits where bits have popped out?',
      fil: 'May maputing pulbos, mantsa ng katas, o maliliit na uka kung saan natuklap ang kongkreto?',
    },
    severity: GENERAL_SEVERITY,
  },
  {
    code: '1.4',
    term: 'Mechanical damage: erosion, collision',
    weight: 1,
    prompt: {
      en: 'Is the concrete worn away or chipped from impact?',
      fil: 'Ang kongkreto ba ay naagnas o natapyas dahil sa pagkakabangga?',
    },
    severity: GENERAL_SEVERITY,
  },
  {
    code: '1.5',
    term: 'Wet surfaces',
    weight: 1,
    prompt: {
      en: 'Are there wet or damp surfaces?',
      fil: 'May basa o mamasa-masang bahagi ba?',
    },
    severity: [
      { en: 'Light', fil: 'Bahagya' },
      { en: 'Medium', fil: 'Katamtaman' },
      { en: 'Heavy', fil: 'Malala' },
      { en: 'Severe', fil: 'Napakalala' },
    ],
  },
  {
    code: '1.6',
    term: 'Cover defects caused by reinforcement corrosion',
    weight: 2,
    prompt: {
      en: 'Are there rust stains, or cracks or loose concrete over the steel bars?',
      fil: 'May mantsa ng kalawang, o bitak o lumuluwag na kongkreto sa ibabaw ng mga bakal?',
    },
    severity: [
      { en: 'Light rust stains', fil: 'Bahagyang mantsa ng kalawang' },
      { en: 'Heavy rust stains', fil: 'Makapal na mantsa ng kalawang' },
      { en: 'Cracks over the steel ties', fil: 'Mga bitak sa ibabaw ng bakal na panali' },
      {
        en: 'Concrete separating in layers over the steel ties',
        fil: 'Humihiwalay na patong ng kongkreto sa ibabaw ng bakal na panali',
      },
    ],
  },
  {
    code: '1.7',
    term: 'Spalling caused by corrosion of reinforcement',
    weight: 3,
    prompt: {
      en: 'Has concrete cracked or broken away along rusting steel bars?',
      fil: 'Nabitak o natuklap ba ang kongkreto sa kahabaan ng kinakalawang na bakal?',
    },
    severity: [
      {
        en: 'Fine cracks along the bars at the corners',
        fil: 'Maninipis na bitak sa kahabaan ng bakal sa mga kanto',
      },
      {
        en: 'Fine cracks along other bars, wider lengthwise cracks, or steel showing at the corners',
        fil: 'Maninipis na bitak sa kahabaan ng ibang bakal, mas malalapad na pahabang bitak, o lantad na bakal sa mga kanto',
      },
      {
        en: 'Wider cracks along other bars, or steel showing',
        fil: 'Mas malalapad na bitak sa kahabaan ng ibang bakal, o lantad na bakal',
      },
      {
        en: 'Hollow-sounding areas and concrete fallen off',
        fil: 'Mga bahaging hungkag ang tunog at natuklap na kongkreto',
      },
    ],
  },
  {
    code: '1.8',
    term: 'Open joints between segments',
    weight: 2,
    prompt: {
      en: 'Are there open gaps at joints between concrete segments?',
      fil: 'May bukas na puwang ba sa mga dugtungan ng kongkreto?',
    },
    severity: [
      { en: 'Up to 1 mm', fil: 'Hanggang 1 mm' },
      { en: '1 to 3 mm', fil: '1 hanggang 3 mm' },
      { en: '3 to 5 mm', fil: '3 hanggang 5 mm' },
      { en: 'More than 5 mm', fil: 'Higit sa 5 mm' },
    ],
  },
  {
    code: '2.1',
    term: 'Corrosion of stirrups',
    weight: 1,
    prompt: {
      en: 'Are the small steel ties (stirrups) rusting?',
      fil: 'Kinakalawang ba ang maliliit na bakal na panali (stirrups)?',
    },
    severity: GENERAL_SEVERITY,
  },
  {
    code: '2.2',
    term: 'Corrosion of main reinforcing bars, reduction of the steel area',
    weight: 3,
    prompt: {
      en: 'Are the main steel bars rusting or eaten away?',
      fil: 'Kinakalawang o naaagnas ba ang mga pangunahing bakal?',
    },
    severity: [
      {
        en: 'Even rust, less than 10% of the bar lost',
        fil: 'Pantay na kalawang, wala pang 10% ng bakal ang nawala',
      },
      {
        en: 'Pitted rust, less than 10% lost',
        fil: 'Butas-butas na kalawang, wala pang 10% ang nawala',
      },
      {
        en: 'Even rust, more than 10% lost',
        fil: 'Pantay na kalawang, higit sa 10% ang nawala',
      },
      {
        en: 'Pitted rust, more than 10% lost',
        fil: 'Butas-butas na kalawang, higit sa 10% ang nawala',
      },
    ],
  },
];

export const STRUCTURAL_DEFECT_CODES = STRUCTURAL_DEFECTS.map((d) => d.code);

export function defectInfo(code: string): DefectInfo | undefined {
  return STRUCTURAL_DEFECTS.find((d) => d.code === code);
}

/**
 * The formula's denominator: every defect at its worst (K2 = 2, K3 = 2) with K4 = 1, as the form's
 * note says. It comes to 72 for the form's ten rows.
 */
export const STRUCTURAL_REFERENCE_SUM =
  STRUCTURAL_DEFECTS.reduce((sum, d) => sum + d.weight, 0) * FACTOR_VALUES[4] * FACTOR_VALUES[4];

/** "How widespread?" (Table A5), lowest first, worded for one element. */
export function extentOptions(element: StructuralElement): FourWordings {
  const { one } = elementInfo(element);
  return [
    { en: `Only one ${one.en}`, fil: `Iisang ${one.fil} lang` },
    { en: 'Several, but fewer than 1/4', fil: 'Ilan, pero wala pang 1/4' },
    { en: '1/4 to 3/4', fil: '1/4 hanggang 3/4' },
    { en: 'More than 3/4', fil: 'Higit sa 3/4' },
  ];
}

/** The four levels with their wording, for a choice list. */
export function levelOptions(wordings: FourWordings): { level: Level; wording: Wording }[] {
  return LEVELS.map((level) => ({ level, wording: wordings[level - 1] }));
}

/* ─── Answers ─── */

/** One defect on one element. Severity and extent are set only when the answer is yes. */
export interface StructuralFinding {
  element: StructuralElement;
  defect: string;
  answer: AnswerValue;
  severity: Level | null;
  extent: Level | null;
  remarks: string | null;
}

export interface CriticalAnswer {
  element: CriticalElement;
  answer: AnswerValue;
}

/** What is submitted and stored. */
export interface StructuralInput {
  findings: StructuralFinding[];
  critical: CriticalAnswer[];
}

/** One answer while it is being filled in. */
export interface StructuralDraftFinding {
  answer?: AnswerValue;
  severity?: Level;
  extent?: Level;
  remarks?: string;
}

/** The structural part of a draft on the phone. `findings` is keyed by findingKey. */
export interface StructuralDraft {
  findings: Record<string, StructuralDraftFinding>;
  critical: Partial<Record<CriticalElement, AnswerValue>>;
}

export const emptyStructuralDraft = (): StructuralDraft => ({ findings: {}, critical: {} });

export const findingKey = (element: StructuralElement, defect: string) => `${element}:${defect}`;

const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

/** Answered, and graded when the answer is yes. */
function findingComplete(
  f: { answer?: AnswerValue; severity?: Level | null; extent?: Level | null } | undefined
): boolean {
  if (!f?.answer) return false;
  return f.answer !== 'yes' || (isLevel(f.severity) && isLevel(f.extent));
}

export interface ElementProgress {
  answered: number;
  total: number;
  /** Defect codes still to answer or to grade, in form order. */
  missingDefects: string[];
  /** The critical-crack check still needs an answer. */
  missingCritical: boolean;
}

/** How far each element has got: its ten defects, plus its critical-crack check when it has one. */
export function structuralProgress(
  draft: StructuralDraft | undefined
): Record<StructuralElement, ElementProgress> {
  const progress = {} as Record<StructuralElement, ElementProgress>;
  for (const element of STRUCTURAL_ELEMENTS) {
    const missingDefects = STRUCTURAL_DEFECT_CODES.filter(
      (code) => !findingComplete(draft?.findings[findingKey(element.code, code)])
    );
    const hasCritical = element.critical !== null;
    const missingCritical = hasCritical && !draft?.critical[element.code as CriticalElement];
    const total = STRUCTURAL_DEFECT_CODES.length + (hasCritical ? 1 : 0);
    progress[element.code] = {
      answered: total - missingDefects.length - (missingCritical ? 1 : 0),
      total,
      missingDefects,
      missingCritical,
    };
  }
  return progress;
}

/** The suffix of an element's critical-crack check in `structuralItemIds`. */
const CRITICAL_SUFFIX = 'critical';

/**
 * One element's checks in form order, as the ids the phone steps through one at a time: its ten
 * defects (`findingKey`), then its critical-crack check ("columns:critical") when it has one.
 */
export function structuralItemIds(element: StructuralElement): string[] {
  const ids = STRUCTURAL_DEFECT_CODES.map((code) => findingKey(element, code));
  if (elementInfo(element).critical) ids.push(findingKey(element, CRITICAL_SUFFIX));
  return ids;
}

/** The defect code of a check id, or null for the critical-crack check. */
export function structuralDefectOf(itemId: string): string | null {
  const code = itemId.slice(itemId.indexOf(':') + 1);
  return code === CRITICAL_SUFFIX ? null : code;
}

/** A check is done: answered, and graded when the answer is yes. */
export function structuralItemDone(draft: StructuralDraft | undefined, itemId: string): boolean {
  const defect = structuralDefectOf(itemId);
  if (defect !== null) return findingComplete(draft?.findings[itemId]);
  const element = itemId.slice(0, itemId.indexOf(':')) as CriticalElement;
  return Boolean(draft?.critical[element]);
}

/** Checks still to answer across all four elements. */
export function structuralMissing(draft: StructuralDraft | undefined): number {
  return Object.values(structuralProgress(draft)).reduce((n, p) => n + p.total - p.answered, 0);
}

/** The draft as it is submitted: complete answers only, in form order. */
export function structuralInputFromDraft(draft: StructuralDraft | undefined): StructuralInput {
  const findings: StructuralFinding[] = [];
  const critical: CriticalAnswer[] = [];
  for (const element of STRUCTURAL_ELEMENTS) {
    for (const code of STRUCTURAL_DEFECT_CODES) {
      const f = draft?.findings[findingKey(element.code, code)];
      if (!f?.answer || !findingComplete(f)) continue;
      const yes = f.answer === 'yes';
      findings.push({
        element: element.code,
        defect: code,
        answer: f.answer,
        severity: yes ? (f.severity ?? null) : null,
        extent: yes ? (f.extent ?? null) : null,
        remarks: f.remarks?.trim() || null,
      });
    }
    if (element.critical) {
      const answer = draft?.critical[element.code as CriticalElement];
      if (answer) critical.push({ element: element.code as CriticalElement, answer });
    }
  }
  return { findings, critical };
}

/** Submitted answers back as a draft, for a queued assessment that is reopened. */
export function structuralDraftFromInput(input: StructuralInput): StructuralDraft {
  const draft = emptyStructuralDraft();
  for (const f of input.findings) {
    draft.findings[findingKey(f.element, f.defect)] = {
      answer: f.answer,
      ...(f.severity ? { severity: f.severity } : {}),
      ...(f.extent ? { extent: f.extent } : {}),
      ...(f.remarks ? { remarks: f.remarks } : {}),
    };
  }
  for (const c of input.critical) draft.critical[c.element] = c.answer;
  return draft;
}

/* ─── Rating ─── */

export type StructuralRecommendation = 'none' | 'local' | 'overall';

export interface ElementRating {
  /** Local condition rating, percent. 0 when nothing was found. */
  lcr: number;
  /** Defects answered yes. */
  found: number;
  /** Defects answered N/A. */
  na: number;
  /** Every defect was N/A: the element wasn't there or couldn't be seen. */
  notAssessed: boolean;
  critical: AnswerValue | null;
  /** Over the threshold, or its critical crack is present. */
  needsInvestigation: boolean;
}

export interface StructuralRating {
  elements: Record<StructuralElement, ElementRating>;
  /** Global condition rating, percent. */
  gcr: number;
  recommendation: StructuralRecommendation;
  /** Elements that need a detailed local investigation, in form order. */
  localElements: StructuralElement[];
  found: number;
  na: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The tool's condition rating. Per element, LCR = Σ(B1 · K2 · K3 · K4) / 72 × 100 over its defects
 * that are present. For the building, GCR = (1.2 LCRcolumns + 1.1 LCRbeams + 0.3 LCRslabs) / 2.6,
 * so walls are rated but don't count. A rating above 15% asks for a detailed investigation: of
 * the whole building when it is the GCR, otherwise of the elements that are over it. An element
 * with its critical crack present is investigated whatever its rating (the form's footnote).
 */
export function rateStructural(input: StructuralInput): StructuralRating {
  const criticalOf = new Map(input.critical.map((c) => [c.element as StructuralElement, c.answer]));
  const elements = {} as Record<StructuralElement, ElementRating>;
  let weighted = 0;
  let factors = 0;
  let found = 0;
  let na = 0;

  for (const element of STRUCTURAL_ELEMENTS) {
    let sum = 0;
    let elementFound = 0;
    let elementNa = 0;
    for (const f of input.findings) {
      if (f.element !== element.code) continue;
      const defect = defectInfo(f.defect);
      if (!defect) continue;
      if (f.answer === 'na') elementNa += 1;
      if (f.answer !== 'yes' || !isLevel(f.severity) || !isLevel(f.extent)) continue;
      elementFound += 1;
      sum += defect.weight * FACTOR_VALUES[f.severity] * FACTOR_VALUES[f.extent] * URGENCY_FACTOR;
    }
    const lcr = round2((100 * sum) / STRUCTURAL_REFERENCE_SUM);
    const critical = criticalOf.get(element.code) ?? null;
    elements[element.code] = {
      lcr,
      found: elementFound,
      na: elementNa,
      notAssessed: elementNa === STRUCTURAL_DEFECT_CODES.length,
      critical,
      needsInvestigation: lcr > STRUCTURAL_THRESHOLD || critical === 'yes',
    };
    weighted += element.factor * lcr;
    factors += element.factor;
    found += elementFound;
    na += elementNa;
  }

  const gcr = round2(weighted / factors);
  const localElements = STRUCTURAL_ELEMENT_CODES.filter(
    (code) => elements[code].needsInvestigation
  );
  const recommendation: StructuralRecommendation =
    gcr > STRUCTURAL_THRESHOLD ? 'overall' : localElements.length > 0 ? 'local' : 'none';
  return { elements, gcr, recommendation, localElements, found, na };
}

export const RECOMMENDATION_TEXT: Record<StructuralRecommendation, string> = {
  none: 'No further action required',
  local: 'Detailed local investigation required',
  overall: 'Overall further investigation needed (Level 2 inspection)',
};

/** "4.2%": one decimal, since most ratings are small. */
export function formatRating(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

export interface PreparedStructural {
  findings: StructuralFinding[];
  critical: CriticalAnswer[];
  rating: StructuralRating;
  /** Checks left unanswered or ungraded. */
  missing: number;
}

/**
 * Server-side: keep one well-formed answer per check in form order, drop grades that don't belong
 * (an answer other than yes carries none), trim remarks, count what is missing and rate it.
 */
export function prepareStructuralWrite(input: StructuralInput): PreparedStructural {
  const submitted = new Map(input.findings.map((f) => [findingKey(f.element, f.defect), f]));
  const criticalOf = new Map(input.critical.map((c) => [c.element, c.answer]));

  const findings: StructuralFinding[] = [];
  const critical: CriticalAnswer[] = [];
  let missing = 0;
  for (const element of STRUCTURAL_ELEMENTS) {
    for (const code of STRUCTURAL_DEFECT_CODES) {
      const f = submitted.get(findingKey(element.code, code));
      if (!f || !findingComplete(f)) {
        missing += 1;
        continue;
      }
      const yes = f.answer === 'yes';
      findings.push({
        element: element.code,
        defect: code,
        answer: f.answer,
        severity: yes ? f.severity : null,
        extent: yes ? f.extent : null,
        remarks: f.remarks?.trim() || null,
      });
    }
    if (element.critical) {
      const answer = criticalOf.get(element.code as CriticalElement);
      if (answer) critical.push({ element: element.code as CriticalElement, answer });
      else missing += 1;
    }
  }

  return { findings, critical, rating: rateStructural({ findings, critical }), missing };
}
