import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AnswerValue } from './assessment-template';
import {
  CRITICAL_ELEMENT_CODES,
  emptyStructuralDraft,
  extentOptions,
  findingKey,
  formatRating,
  prepareStructuralWrite,
  rateStructural,
  STRUCTURAL_DEFECT_CODES,
  STRUCTURAL_DEFECTS,
  STRUCTURAL_ELEMENT_CODES,
  STRUCTURAL_ELEMENTS,
  STRUCTURAL_REFERENCE_SUM,
  structuralDraftFromInput,
  structuralInputFromDraft,
  structuralMissing,
  structuralProgress,
  type Level,
  type StructuralDraft,
  type StructuralElement,
  type StructuralFinding,
  type StructuralInput,
} from './structural-integrity';

// The structural integrity checks (RCAsT, Material Component) and the tool's condition rating,
// checked against the numbers on the paper form.

const yes = (
  element: StructuralElement,
  defect: string,
  severity: Level,
  extent: Level
): StructuralFinding => ({ element, defect, answer: 'yes', severity, extent, remarks: null });

/** Every check answered `answer`, with `found` replacing the matching rows. */
const complete = (
  found: StructuralFinding[] = [],
  answer: AnswerValue = 'no',
  critical: AnswerValue = 'no'
): StructuralInput => {
  const byKey = new Map(found.map((f) => [findingKey(f.element, f.defect), f]));
  return {
    findings: STRUCTURAL_ELEMENT_CODES.flatMap((element) =>
      STRUCTURAL_DEFECT_CODES.map(
        (defect) =>
          byKey.get(findingKey(element, defect)) ?? {
            element,
            defect,
            answer,
            severity: null,
            extent: null,
            remarks: null,
          }
      )
    ),
    critical: CRITICAL_ELEMENT_CODES.map((element) => ({ element, answer: critical })),
  };
};

test('the form: ten defects with basic values adding up to 18, so the reference sum is 72', () => {
  assert.equal(STRUCTURAL_DEFECTS.length, 10);
  assert.deepEqual(
    STRUCTURAL_DEFECTS.map((d) => [d.code, d.weight]),
    [
      ['1.1', 1],
      ['1.2', 3],
      ['1.3', 1],
      ['1.4', 1],
      ['1.5', 1],
      ['1.6', 2],
      ['1.7', 3],
      ['1.8', 2],
      ['2.1', 1],
      ['2.2', 3],
    ]
  );
  assert.equal(STRUCTURAL_REFERENCE_SUM, 72);
  assert.deepEqual(
    STRUCTURAL_ELEMENTS.map((e) => [e.code, e.factor]),
    [
      ['columns', 1.2],
      ['beams', 1.1],
      ['slabs', 0.3],
      ['walls', 0],
    ]
  );
});

test('every question and choice has English and Filipino wording', () => {
  for (const d of STRUCTURAL_DEFECTS) {
    for (const w of [d.prompt, ...d.severity]) {
      assert.ok(w.en.trim() && w.fil.trim(), `defect ${d.code}`);
    }
  }
  for (const e of STRUCTURAL_ELEMENTS) {
    for (const w of [
      e.title,
      e.one,
      ...extentOptions(e.code),
      ...(e.critical ? [e.critical] : []),
    ]) {
      assert.ok(w.en.trim() && w.fil.trim(), `element ${e.code}`);
    }
  }
  assert.equal(extentOptions('beams')[0].en, 'Only one beam');
});

test('nothing found rates 0 and needs no further action', () => {
  const rating = rateStructural(complete());
  assert.equal(rating.gcr, 0);
  assert.equal(rating.recommendation, 'none');
  assert.deepEqual(rating.localElements, []);
  assert.equal(rating.found, 0);
});

test('one thin crack on one column is about 1% for columns', () => {
  // B1 3 × K2 0.5 × K3 0.5 × K4 1 = 0.75, over 72.
  const rating = rateStructural(complete([yes('columns', '1.2', 1, 1)]));
  assert.equal(rating.elements.columns.lcr, 1.04);
  // (1.2 × 1.04) / 2.6
  assert.equal(rating.gcr, 0.48);
  assert.equal(rating.recommendation, 'none');
});

test('wide cracks on most columns cross the 15% line for columns only', () => {
  // 3 × 2 × 2 = 12, over 72 = 16.67%.
  const rating = rateStructural(complete([yes('columns', '1.2', 4, 4)]));
  assert.equal(rating.elements.columns.lcr, 16.67);
  assert.equal(rating.elements.columns.needsInvestigation, true);
  // (1.2 × 16.67) / 2.6 = 7.69: the building as a whole stays under the line.
  assert.equal(rating.gcr, 7.69);
  assert.equal(rating.recommendation, 'local');
  assert.deepEqual(rating.localElements, ['columns']);
});

test('every defect at its worst is 100% per element, and 100% for the building', () => {
  const worst = STRUCTURAL_ELEMENT_CODES.flatMap((element) =>
    STRUCTURAL_DEFECT_CODES.map((defect) => yes(element, defect, 4, 4))
  );
  const rating = rateStructural(complete(worst));
  for (const element of STRUCTURAL_ELEMENT_CODES) assert.equal(rating.elements[element].lcr, 100);
  assert.equal(rating.gcr, 100);
  assert.equal(rating.recommendation, 'overall');
  assert.equal(rating.found, 40);
});

test('the building rating weighs columns 1.2, beams 1.1 and slabs 0.3; walls do not count', () => {
  const worstOf = (element: StructuralElement) =>
    STRUCTURAL_DEFECT_CODES.map((defect) => yes(element, defect, 4, 4));
  assert.equal(rateStructural(complete(worstOf('columns'))).gcr, 46.15);
  assert.equal(rateStructural(complete(worstOf('beams'))).gcr, 42.31);
  assert.equal(rateStructural(complete(worstOf('slabs'))).gcr, 11.54);

  const walls = rateStructural(complete(worstOf('walls')));
  assert.equal(walls.gcr, 0);
  assert.equal(walls.elements.walls.lcr, 100);
  // Walls are still rated, so they still ask for a local investigation.
  assert.equal(walls.recommendation, 'local');
  assert.deepEqual(walls.localElements, ['walls']);
});

test('a critical crack asks for a local investigation whatever the rating', () => {
  const input = complete();
  input.critical = [
    { element: 'columns', answer: 'no' },
    { element: 'beams', answer: 'yes' },
    { element: 'walls', answer: 'na' },
  ];
  const rating = rateStructural(input);
  assert.equal(rating.gcr, 0);
  assert.equal(rating.recommendation, 'local');
  assert.deepEqual(rating.localElements, ['beams']);
  assert.equal(rating.elements.beams.critical, 'yes');
  assert.equal(rating.elements.slabs.critical, null);
});

test('N/A scores nothing and an element that is all N/A reads as not assessed', () => {
  const input = complete();
  for (const f of input.findings) if (f.element === 'beams') f.answer = 'na';
  const rating = rateStructural(input);
  assert.equal(rating.elements.beams.notAssessed, true);
  assert.equal(rating.elements.beams.lcr, 0);
  assert.equal(rating.elements.columns.notAssessed, false);
  assert.equal(rating.na, 10);
});

test('progress counts ten defects per element plus the critical check where there is one', () => {
  const empty = structuralProgress(undefined);
  assert.deepEqual(
    STRUCTURAL_ELEMENT_CODES.map((e) => [empty[e].answered, empty[e].total]),
    [
      [0, 11],
      [0, 11],
      [0, 10],
      [0, 11],
    ]
  );
  assert.equal(structuralMissing(undefined), 43);

  const draft: StructuralDraft = emptyStructuralDraft();
  draft.findings[findingKey('columns', '1.1')] = { answer: 'no' };
  // Yes without its two grades isn't finished yet.
  draft.findings[findingKey('columns', '1.2')] = { answer: 'yes', severity: 2 };
  draft.findings[findingKey('columns', '1.3')] = { answer: 'yes', severity: 2, extent: 1 };
  draft.critical.columns = 'no';
  const progress = structuralProgress(draft);
  assert.equal(progress.columns.answered, 3);
  assert.equal(progress.columns.missingCritical, false);
  assert.ok(progress.columns.missingDefects.includes('1.2'));
  assert.ok(!progress.columns.missingDefects.includes('1.3'));
  assert.equal(structuralMissing(draft), 40);
});

test('a draft becomes the submitted answers and back', () => {
  const draft: StructuralDraft = emptyStructuralDraft();
  draft.findings[findingKey('slabs', '1.5')] = {
    answer: 'yes',
    severity: 3,
    extent: 2,
    remarks: '  near the stairs  ',
  };
  // Grades left over from an earlier Yes are dropped once the answer is No.
  draft.findings[findingKey('slabs', '1.6')] = { answer: 'no', severity: 4, extent: 4 };
  draft.findings[findingKey('slabs', '1.7')] = { answer: 'yes' };
  draft.critical.walls = 'yes';

  const input = structuralInputFromDraft(draft);
  assert.deepEqual(input.findings, [
    {
      element: 'slabs',
      defect: '1.5',
      answer: 'yes',
      severity: 3,
      extent: 2,
      remarks: 'near the stairs',
    },
    { element: 'slabs', defect: '1.6', answer: 'no', severity: null, extent: null, remarks: null },
  ]);
  assert.deepEqual(input.critical, [{ element: 'walls', answer: 'yes' }]);

  const back = structuralDraftFromInput(input);
  assert.deepEqual(back.findings[findingKey('slabs', '1.5')], {
    answer: 'yes',
    severity: 3,
    extent: 2,
    remarks: 'near the stairs',
  });
  assert.deepEqual(back.critical, { walls: 'yes' });
  assert.deepEqual(structuralInputFromDraft(back), input);
});

test('the server counts what is missing and drops grades that do not belong', () => {
  assert.equal(prepareStructuralWrite({ findings: [], critical: [] }).missing, 43);

  const whole = prepareStructuralWrite(complete([yes('beams', '1.7', 3, 2)]));
  assert.equal(whole.missing, 0);
  assert.equal(whole.findings.length, 40);
  assert.equal(whole.critical.length, 3);
  // 3 × 1.5 × 1 = 4.5, over 72.
  assert.equal(whole.rating.elements.beams.lcr, 6.25);

  const input = complete();
  // A Yes with no grades counts as missing; a No keeps no grades.
  input.findings[0] = { ...input.findings[0], answer: 'yes' };
  input.findings[1] = { ...input.findings[1], answer: 'no', severity: 4, extent: 4 };
  // Rows the form doesn't have are ignored.
  input.findings.push({ ...yes('columns', '9.9', 4, 4) });
  const prepared = prepareStructuralWrite(input);
  assert.equal(prepared.missing, 1);
  assert.equal(prepared.findings.length, 39);
  assert.deepEqual(
    [prepared.findings[0].defect, prepared.findings[0].severity, prepared.findings[0].extent],
    ['1.2', null, null]
  );
  assert.equal(prepared.rating.gcr, 0);
});

test('ratings read with one decimal', () => {
  assert.equal(formatRating(0), '0.0%');
  assert.equal(formatRating(16.67), '16.7%');
  assert.equal(formatRating(100), '100.0%');
});
