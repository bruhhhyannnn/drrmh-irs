'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Banner, Button, FOCUS_RING, SegmentedControl } from '@/components/ds';
import { cn } from '@/lib';
import { activeStructuralItem, type AssessmentDraft } from '@/lib/assessment-draft';
import type { AnswerValue } from '@/lib/assessment-template';
import {
  STRUCTURAL_DEFECTS,
  STRUCTURAL_ELEMENT_CODES,
  elementInfo,
  emptyStructuralDraft,
  extentOptions,
  findingKey,
  levelOptions,
  structuralDefectOf,
  structuralProgress,
  type CriticalElement,
  type DefectInfo,
  type Level,
  type StructuralDraft,
  type StructuralDraftFinding,
  type StructuralElement,
  type Wording,
} from '@/lib/structural-integrity';
import { Check, ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { Card, Mono, Pill } from '../../_components/chrome';
import type { StepProps } from './details-step';
import { Remarks } from './section-step';

const ANSWER_OPTIONS: { value: AnswerValue; label: string }[] = [
  { value: 'yes', label: 'YES' },
  { value: 'na', label: 'N/A' },
  { value: 'no', label: 'NO' },
];

type Patch = (s: StructuralDraft) => StructuralDraft;

/**
 * The structural integrity checks for one building element (DRRM-044): the tool's ten defects,
 * each Yes / N/A / No. A Yes opens "How bad?" and "How widespread?", which the rating needs.
 * Columns, beams and walls end with their critical-crack check.
 * - Below `lg`: one check at a time, like the checklist's flashcards. No and N/A move on at once;
 *   Yes moves on once both grades are chosen.
 * - From `lg`: every check of the element in one list.
 */
export function StructuralStep({
  draft,
  update,
  element,
  onOpenIndex,
  onChangeAndAdvance,
}: Pick<StepProps, 'draft' | 'update'> & {
  element: StructuralElement;
  onOpenIndex?: () => void;
  /** Applies a change, then moves to the next check, or with `toNextStep` to the next step. */
  onChangeAndAdvance?: (fn: (d: AssessmentDraft) => AssessmentDraft, toNextStep?: boolean) => void;
}) {
  const info = elementInfo(element);
  const structural = draft.structural ?? emptyStructuralDraft();
  const progress = structuralProgress(draft.structural)[element];
  const left = progress.total - progress.answered;
  const position = STRUCTURAL_ELEMENT_CODES.indexOf(element) + 1;
  const criticalElement = info.critical ? (element as CriticalElement) : null;

  const onDraft =
    (fn: Patch) =>
    (d: AssessmentDraft): AssessmentDraft => ({
      ...d,
      structural: fn(d.structural ?? emptyStructuralDraft()),
    });
  const patch = (fn: Patch) => update(onDraft(fn));
  /** Patches, then moves on when the phone view can (a plain patch otherwise). */
  const patchAndAdvance = (fn: Patch, toNextStep = false) =>
    onChangeAndAdvance ? onChangeAndAdvance(onDraft(fn), toNextStep) : patch(fn);

  const findingPatch =
    (defect: string, change: StructuralDraftFinding): Patch =>
    (s) => {
      const key = findingKey(element, defect);
      return { ...s, findings: { ...s.findings, [key]: { ...s.findings[key], ...change } } };
    };
  const setFinding = (defect: string, change: StructuralDraftFinding) =>
    patch(findingPatch(defect, change));

  const criticalPatch =
    (answer: AnswerValue): Patch =>
    (s) =>
      criticalElement ? { ...s, critical: { ...s.critical, [criticalElement]: answer } } : s;

  /** Answers every check on this page that has no answer yet; answered ones stay as they are. */
  const fillRestPatch =
    (answer: 'no' | 'na'): Patch =>
    (s) => {
      const findings = { ...s.findings };
      for (const defect of STRUCTURAL_DEFECTS) {
        const key = findingKey(element, defect.code);
        if (!findings[key]?.answer) findings[key] = { ...findings[key], answer };
      }
      const critical =
        criticalElement && !s.critical[criticalElement]
          ? { ...s.critical, [criticalElement]: answer }
          : s.critical;
      return { ...s, findings, critical };
    };
  const fillRest = (answer: 'no' | 'na') => patch(fillRestPatch(answer));

  const unanswered =
    STRUCTURAL_DEFECTS.some((d) => !structural.findings[findingKey(element, d.code)]?.answer) ||
    (criticalElement !== null && !structural.critical[criticalElement]);

  /* ─── Phone: the check in view ─── */
  const active = activeStructuralItem(draft, element);
  const activeCode = structuralDefectOf(active.id);
  const activeDefect = activeCode
    ? STRUCTURAL_DEFECTS.find((d) => d.code === activeCode)
    : undefined;
  const activeValue = structural.findings[active.id];
  const isGraded = (f: StructuralDraftFinding | undefined) => Boolean(f?.severity && f?.extent);

  const answerActive = (answer: AnswerValue) => {
    if (!activeCode) {
      patchAndAdvance(criticalPatch(answer));
      return;
    }
    // Yes waits for its two grades, unless they were chosen before.
    if (answer === 'yes' && !isGraded(activeValue)) setFinding(activeCode, { answer });
    else patchAndAdvance(findingPatch(activeCode, { answer }));
  };

  const gradeActive = (change: { severity?: Level; extent?: Level }) => {
    if (!activeCode) return;
    // Moves on once the second grade is chosen; changing a grade afterwards stays put.
    if (!isGraded(activeValue) && isGraded({ ...activeValue, ...change })) {
      patchAndAdvance(findingPatch(activeCode, change));
    } else {
      setFinding(activeCode, change);
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col lg:hidden">
        <StructuralFlashcard
          element={element}
          itemId={active.id}
          index={active.index}
          total={active.ids.length}
          defect={activeDefect}
          value={activeValue}
          critical={criticalElement ? structural.critical[criticalElement] : undefined}
          canFillRest={unanswered}
          onOpenIndex={onOpenIndex}
          onFillRest={(answer) => patchAndAdvance(fillRestPatch(answer), true)}
          onAnswer={answerActive}
          onGrade={gradeActive}
          onRemarks={(remarks) => activeCode && setFinding(activeCode, { remarks })}
        />
      </div>

      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <Card className="flex flex-col gap-3 p-5 md:p-6">
          <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
            Structural integrity · <Mono>{position}</Mono> of{' '}
            <Mono>{STRUCTURAL_ELEMENT_CODES.length}</Mono>
          </span>
          <Bilingual
            as="h2"
            en={info.title.en}
            fil={info.title.fil}
            className="text-[22px] leading-[1.25] font-extrabold"
          />
          <p className="text-[15px] leading-[1.45] text-gray-600">
            Look at the {info.title.en.toLowerCase()} you can see. Answer Yes when the defect is
            there, then say how bad and how widespread it is. N/A means there are none here, or they
            can&apos;t be seen.
          </p>
          <p className="text-[14px] text-gray-600">
            <Mono>{progress.answered}</Mono> of <Mono>{progress.total}</Mono> answered
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!unanswered}
              onClick={() => fillRest('no')}
            >
              Mark the rest No
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!unanswered}
              onClick={() => fillRest('na')}
            >
              Mark the rest N/A
            </Button>
          </div>
        </Card>

        {STRUCTURAL_DEFECTS.map((defect) => (
          <DefectCard
            key={defect.code}
            element={element}
            defect={defect}
            value={structural.findings[findingKey(element, defect.code)]}
            onChange={(change) => setFinding(defect.code, change)}
          />
        ))}

        {info.critical && criticalElement && (
          <CriticalCard
            element={element}
            prompt={info.critical}
            value={structural.critical[criticalElement]}
            onChange={(answer) => patch(criticalPatch(answer))}
          />
        )}

        {left === 0 && (
          <p className="text-center text-[14px] font-semibold text-success-700">
            Every check for {info.title.en.toLowerCase()} is answered.
          </p>
        )}
      </div>
    </>
  );
}

/**
 * One structural check on the phone, laid out like the checklist's flashcard: the element button
 * (opens Questions) and the count at the top, the question in the middle with its two grades
 * once it is Yes, and large YES | N/A | NO buttons at the bottom.
 */
function StructuralFlashcard({
  element,
  itemId,
  index,
  total,
  defect,
  value,
  critical,
  canFillRest,
  onOpenIndex,
  onFillRest,
  onAnswer,
  onGrade,
  onRemarks,
}: {
  element: StructuralElement;
  itemId: string;
  index: number;
  total: number;
  /** Undefined on the critical-crack check. */
  defect?: DefectInfo;
  value?: StructuralDraftFinding;
  critical?: AnswerValue;
  canFillRest: boolean;
  onOpenIndex?: () => void;
  onFillRest: (answer: 'no' | 'na') => void;
  onAnswer: (answer: AnswerValue) => void;
  onGrade: (change: { severity?: Level; extent?: Level }) => void;
  onRemarks: (remarks: string) => void;
}) {
  const promptId = useId();
  const info = elementInfo(element);
  const selected = defect ? value?.answer : critical;
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const prompt = defect ? defect.prompt : info.critical;
  const ungraded = defect && value?.answer === 'yes' && (!value.severity || !value.extent);

  return (
    <Card
      key={itemId}
      id={`flashcard-${itemId}`}
      className="flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6"
    >
      {/* Top: the element (opens Questions), Question k / n and the progress bar */}
      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={onOpenIndex}
          className={cn(
            'inline-flex max-w-full items-center gap-2 rounded-2xl border border-line bg-gray-50 px-3.5 py-2 text-left transition-colors hover:bg-gray-100',
            FOCUS_RING
          )}
        >
          <Mono className="bg-brand-25 text-brand-500 grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1.5 text-[12px] font-bold">
            SI
          </Mono>
          <span className="truncate text-[14px] font-bold text-gray-900">
            Structural integrity: {info.title.en}
          </span>
          <ChevronDown size={16} aria-hidden className="shrink-0 text-gray-500" />
        </button>

        <div className="flex items-center gap-2 text-[14px] font-semibold text-gray-600">
          <span>
            Question <Mono className="font-bold text-gray-900">{index + 1}</Mono> /{' '}
            <Mono>{total}</Mono>
          </span>
          <span aria-hidden className="text-gray-300">
            ·
          </span>
          <Mono className="text-[13px] text-gray-500">{defect ? defect.code : 'Critical'}</Mono>
        </div>

        <div aria-hidden className="h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-gray-100">
          <div
            className="bg-brand-500 h-full rounded-full transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        {canFillRest && (
          <p className="flex flex-wrap items-center justify-center gap-x-1 text-[13px] text-gray-600">
            Nothing else on the {info.title.en.toLowerCase()}? Mark the rest
            <button
              type="button"
              onClick={() => onFillRest('no')}
              className={cn('rounded px-0.5 font-bold text-brand-700 underline', FOCUS_RING)}
            >
              No
            </button>
            or
            <button
              type="button"
              onClick={() => onFillRest('na')}
              className={cn('rounded px-0.5 font-bold text-brand-700 underline', FOCUS_RING)}
            >
              N/A
            </button>
          </p>
        )}
      </div>

      {/* Middle: the question, its grades once it is Yes, and remarks */}
      <div className="my-auto flex flex-col items-center gap-4 py-4 text-center">
        {!defect && <Pill tone="warning">Critical crack check</Pill>}
        {prompt && (
          <Bilingual
            id={promptId}
            as="h2"
            en={prompt.en}
            fil={prompt.fil}
            className="max-w-xl text-[20px] leading-[1.35] font-extrabold text-balance text-gray-900 sm:text-[22px]"
          />
        )}
        {defect && (
          <p className="max-w-md text-[13px] leading-[1.4] text-gray-500">
            On the form: {defect.term}
          </p>
        )}

        {defect && value?.answer === 'yes' && (
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4 text-left">
            <ChoiceList
              label="How bad is it?"
              name={`flash-${itemId}-severity`}
              options={levelOptions(defect.severity)}
              value={value.severity}
              onChange={(severity) => onGrade({ severity })}
            />
            <ChoiceList
              label="How widespread is it?"
              name={`flash-${itemId}-extent`}
              options={levelOptions(extentOptions(element))}
              value={value.extent}
              onChange={(extent) => onGrade({ extent })}
            />
            {ungraded && (
              <p className="text-[13px] font-semibold text-warning-700">
                Choose both to go on to the next question.
              </p>
            )}
          </div>
        )}

        {!defect && critical === 'yes' && (
          <div className="w-full max-w-md text-left">
            <Banner tone="warning">
              This crack calls for a detailed investigation of the {info.title.en.toLowerCase()},
              whatever the rating comes to.
            </Banner>
          </div>
        )}

        {defect && (
          <div className="flex w-full max-w-md flex-col items-center gap-2 text-left">
            <Remarks key={itemId} value={value?.remarks ?? ''} onChange={onRemarks} />
          </div>
        )}
      </div>

      {/* Bottom: large thumb-friendly YES | N/A | NO buttons */}
      <div role="radiogroup" aria-labelledby={promptId} className="grid grid-cols-3 gap-2.5 pt-1">
        {ANSWER_OPTIONS.map((option) => {
          const on = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onAnswer(option.value)}
              className={cn(
                'flex h-14 items-center justify-center gap-1.5 rounded-2xl px-2 text-[16px] font-extrabold transition-[transform,colors] duration-120 active:scale-97',
                on
                  ? 'border-brand-500 bg-brand-25 text-brand-500 border-2 shadow-xs'
                  : 'border-[1.5px] border-gray-300 bg-surface text-gray-900 hover:border-gray-400 hover:bg-hover',
                FOCUS_RING
              )}
            >
              {on && <Check size={16} strokeWidth={3} aria-hidden className="shrink-0" />}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** One defect: its question, Yes / N/A / No, the two grades when it is there, and remarks. */
function DefectCard({
  element,
  defect,
  value,
  onChange,
}: {
  element: StructuralElement;
  defect: DefectInfo;
  value?: StructuralDraftFinding;
  onChange: (change: StructuralDraftFinding) => void;
}) {
  const promptId = useId();
  const present = value?.answer === 'yes';
  const ungraded = present && (!value?.severity || !value?.extent);
  const name = `structural-${element}-${defect.code}`;

  return (
    <Card
      id={`item-${findingKey(element, defect.code)}`}
      tabIndex={-1}
      className="scroll-mt-4 p-5 outline-none md:p-6"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Mono className="w-9 shrink-0 pt-0.5 text-[13px] text-gray-500">{defect.code}</Mono>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Bilingual
              id={promptId}
              as="p"
              en={defect.prompt.en}
              fil={defect.prompt.fil}
              className="text-[16px] leading-[1.45] font-semibold"
            />
            <p className="text-[13px] leading-[1.4] text-gray-500">On the form: {defect.term}</p>
          </div>
        </div>

        <SegmentedControl
          name={`${name}-answer`}
          labelledBy={promptId}
          options={ANSWER_OPTIONS}
          value={value?.answer ?? ''}
          onChange={(answer) => onChange({ answer: answer as AnswerValue })}
        />

        {present && (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4">
            <ChoiceList
              label="How bad is it?"
              name={`${name}-severity`}
              options={levelOptions(defect.severity)}
              value={value?.severity}
              onChange={(severity) => onChange({ severity })}
            />
            <ChoiceList
              label="How widespread is it?"
              name={`${name}-extent`}
              options={levelOptions(extentOptions(element))}
              value={value?.extent}
              onChange={(extent) => onChange({ extent })}
            />
            {ungraded && (
              <p className="text-[13px] font-semibold text-warning-700">
                Choose both to finish this check.
              </p>
            )}
          </div>
        )}

        <Remarks value={value?.remarks ?? ''} onChange={(remarks) => onChange({ remarks })} />
      </div>
    </Card>
  );
}

/** The crack that makes an element critical (the form's footnote). */
function CriticalCard({
  element,
  prompt,
  value,
  onChange,
}: {
  element: StructuralElement;
  prompt: Wording;
  value?: AnswerValue;
  onChange: (answer: AnswerValue) => void;
}) {
  const promptId = useId();
  const info = elementInfo(element);
  return (
    <Card
      id={`item-${findingKey(element, 'critical')}`}
      tabIndex={-1}
      className="scroll-mt-4 p-5 outline-none md:p-6"
    >
      <div className="flex flex-col gap-3">
        <div className="self-start">
          <Pill tone="warning">Critical crack check</Pill>
        </div>
        <Bilingual
          id={promptId}
          as="p"
          en={prompt.en}
          fil={prompt.fil}
          className="text-[16px] leading-[1.45] font-semibold"
        />
        <SegmentedControl
          name={`structural-${element}-critical`}
          labelledBy={promptId}
          options={ANSWER_OPTIONS}
          value={value ?? ''}
          onChange={(answer) => onChange(answer as AnswerValue)}
        />
        {value === 'yes' && (
          <Banner tone="warning">
            This crack calls for a detailed investigation of the {info.title.en.toLowerCase()},
            whatever the rating comes to.
          </Banner>
        )}
      </div>
    </Card>
  );
}

/** Four graded choices, one per line, lowest first. */
function ChoiceList({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { level: Level; wording: Wording }[];
  value?: Level;
  onChange: (level: Level) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-[14px] font-bold text-gray-700">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid gap-2 sm:grid-cols-2">
        {options.map(({ level, wording }) => {
          const on = value === level;
          return (
            <label
              key={level}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-[15px] leading-[1.35] transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]',
                on
                  ? 'border-brand-500 bg-brand-25 border-2 font-semibold text-gray-900'
                  : 'border-[1.5px] border-gray-300 bg-surface text-gray-800 hover:border-gray-400 hover:bg-hover'
              )}
            >
              <input
                type="radio"
                name={name}
                value={level}
                checked={on}
                onChange={() => onChange(level)}
                className="sr-only"
              />
              <Mono
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold',
                  on ? 'bg-brand-solid text-white' : 'bg-gray-100 text-gray-600'
                )}
              >
                {level}
              </Mono>
              <Bilingual en={wording.en} fil={wording.fil} className="min-w-0 flex-1" />
            </label>
          );
        })}
      </div>
    </div>
  );
}
