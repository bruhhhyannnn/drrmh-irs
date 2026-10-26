'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { FieldLabel, FOCUS_RING, SegmentedControl, TextArea } from '@/components/ds';
import { cn } from '@/lib';
import { activeSectionItem, sectionProgress, type DraftAnswer } from '@/lib/assessment-draft';
import { applicableItems } from '@/lib/assessment-score';
import {
  itemLabel,
  type AnswerValue,
  type TemplateItem,
  type TemplateSection,
} from '@/lib/assessment-template';
import { Check, ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Card, Mono, Pill } from '../../_components/chrome';
import type { StepProps } from './details-step';

const ANSWER_OPTIONS: { value: AnswerValue; label: string }[] = [
  { value: 'yes', label: 'YES' },
  { value: 'na', label: 'N/A' },
  { value: 'no', label: 'NO' },
];

/**
 * One checklist section:
 * - Below `lg` (mobile / tablet): a 1-question-at-a-time flashcard with a tappable section
 *   header at the top, the question in the middle, and large YES | N/A | NO buttons at the
 *   bottom that auto-advance to the next question.
 * - From `lg` (desktop): every question in the section listed in paper-form order.
 */
export function SectionStep({
  template,
  draft,
  update,
  section,
  onOpenIndex,
  onAnswerAndAdvance,
}: StepProps & {
  section: TemplateSection;
  onOpenIndex?: () => void;
  onAnswerAndAdvance?: (itemId: string, answer: AnswerValue) => void;
}) {
  const commentId = useId();
  const applies = new Set(
    applicableItems(template, draft.floor_count, draft.area_type_ids).map((i) => i.id)
  );
  const items = section.items.filter((i) => applies.has(i.id));
  const topLevel = items.filter((i) => i.parent_id === null);
  const progress = sectionProgress(template, draft)[section.id] ?? { answered: 0, total: 0 };
  const active = activeSectionItem(template, draft, section.id);

  const setAnswer = (itemId: string, patch: DraftAnswer) =>
    update((d) => ({
      ...d,
      answers: { ...d.answers, [itemId]: { ...d.answers[itemId], ...patch } },
    }));

  const rowProps = (item: TemplateItem) => ({
    item,
    label: itemLabel(section, item),
    value: draft.answers[item.id],
    onChange: (patch: DraftAnswer) => setAnswer(item.id, patch),
  });

  return (
    <>
      {active && (
        <div className="flex flex-1 flex-col lg:hidden">
          <FlashcardCard
            section={section}
            item={active.item}
            parent={
              active.item.parent_id
                ? section.items.find((p) => p.id === active.item.parent_id)
                : undefined
            }
            index={active.index}
            total={active.items.length}
            value={draft.answers[active.item.id]}
            sectionComment={draft.comments[section.id] ?? ''}
            onChange={(patch) => setAnswer(active.item.id, patch)}
            onSelectAnswer={(answer) => {
              if (onAnswerAndAdvance) onAnswerAndAdvance(active.item.id, answer);
              else setAnswer(active.item.id, { answer });
            }}
            onChangeSectionComment={(comment) =>
              update((d) => ({ ...d, comments: { ...d.comments, [section.id]: comment } }))
            }
            onOpenIndex={onOpenIndex}
          />
        </div>
      )}

      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <Card className="flex flex-col gap-2 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <Mono className="bg-brand-25 text-brand-500 grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-1.5 text-[14px] font-semibold">
              {section.code}
            </Mono>
            <Bilingual
              as="h2"
              en={section.title_en}
              fil={section.title_fil}
              className="flex-1 text-[19px] leading-[1.3] font-bold"
            />
          </div>
          <p className="text-[14px] text-gray-600">
            <Mono>{progress.answered}</Mono> of <Mono>{progress.total}</Mono> answered
          </p>
        </Card>

        {topLevel.map((item) =>
          item.is_scored ? (
            <Card
              key={item.id}
              id={`item-${item.id}`}
              tabIndex={-1}
              className="scroll-mt-4 p-5 outline-none focus-visible:ring-3 focus-visible:ring-[#5a9ef2] md:p-6"
            >
              <ItemRow {...rowProps(item)} />
            </Card>
          ) : (
            <GroupCard
              key={item.id}
              parent={rowProps(item)}
              items={items.filter((i) => i.parent_id === item.id).map(rowProps)}
            />
          )
        )}

        <Card className="flex flex-col gap-2 p-5 md:p-6">
          <FieldLabel htmlFor={commentId} hint="Optional">
            Comments on this section
          </FieldLabel>
          <TextArea
            id={commentId}
            maxLength={2000}
            value={draft.comments[section.id] ?? ''}
            onChange={(e) => {
              const comment = e.target.value;
              update((d) => ({ ...d, comments: { ...d.comments, [section.id]: comment } }));
            }}
          />
        </Card>
      </div>
    </>
  );
}

/** Mobile / tablet flashcard for a single scored question. */
function FlashcardCard({
  section,
  item,
  parent,
  index,
  total,
  value,
  sectionComment,
  onChange,
  onSelectAnswer,
  onChangeSectionComment,
  onOpenIndex,
}: {
  section: TemplateSection;
  item: TemplateItem;
  parent?: TemplateItem;
  index: number;
  total: number;
  value?: DraftAnswer;
  sectionComment: string;
  onChange: (patch: DraftAnswer) => void;
  onSelectAnswer: (answer: AnswerValue) => void;
  onChangeSectionComment: (comment: string) => void;
  onOpenIndex?: () => void;
}) {
  const promptId = useId();
  const label = itemLabel(section, item);
  const parentLabel = parent ? itemLabel(section, parent) : null;
  const reference = item.reference || parent?.reference || null;
  const selected = value?.answer;
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

  return (
    <Card
      key={item.id}
      id={`flashcard-${item.id}`}
      className="flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6"
    >
      {/* Top: tappable section dropdown + Question k / n */}
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
            {section.code}
          </Mono>
          <span className=" truncate text-[14px] font-bold text-gray-900">{section.title_en}</span>
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
          <Mono className="text-[13px] text-gray-500">{label}</Mono>
        </div>

        <div aria-hidden className="h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-gray-100">
          <div
            className="bg-brand-500 h-full rounded-full transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Middle: the question prompt (with parent context when part of a group) */}
      <div className="my-auto flex flex-col items-center gap-4 py-4 text-center">
        {parent && (
          <div className="w-full rounded-2xl border border-line bg-gray-50 px-4 py-3 text-left">
            <Mono className="text-[12px] font-semibold text-gray-500">{parentLabel}</Mono>
            <Bilingual
              as="p"
              en={parent.prompt_en}
              fil={parent.prompt_fil}
              className="mt-0.5 text-[14px] leading-[1.4] font-semibold text-gray-700"
            />
          </div>
        )}

        <Bilingual
          id={promptId}
          as="h2"
          en={item.prompt_en}
          fil={item.prompt_fil}
          className="max-w-xl text-[20px] leading-[1.35] font-extrabold text-balance text-gray-900 sm:text-[22px]"
        />

        {item.safe_answer === 'no' && <Pill tone="warning">Yes here means a hazard</Pill>}

        {reference && (
          <details className="w-full max-w-md rounded-xl border border-line bg-gray-50 px-3.5 py-2 text-left text-[13px] text-gray-600">
            <summary className="cursor-pointer font-semibold text-gray-700">Reference</summary>
            <p className="mt-1.5 leading-[1.45]">{reference}</p>
          </details>
        )}

        <div className="flex w-full max-w-md flex-col items-center gap-2 text-left">
          <Remarks value={value?.remarks ?? ''} onChange={(remarks) => onChange({ remarks })} />
          {index === total - 1 && (
            <Remarks
              label="Comments on this section"
              buttonLabel="Add section comment"
              value={sectionComment}
              onChange={onChangeSectionComment}
            />
          )}
        </div>
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
              onClick={() => onSelectAnswer(option.value)}
              className={cn(
                'flex h-14 items-center justify-center gap-1.5 rounded-2xl px-2 text-[16px] font-extrabold transition-[transform,colors] duration-120 active:scale-97',
                on
                  ? 'border-brand-500 bg-brand-25 text-brand-500 border-2 shadow-xs'
                  : 'border-[1.5px] border-gray-300 bg-surface text-gray-900 hover:border-gray-400 hover:bg-gray-50',
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

type RowProps = {
  item: TemplateItem;
  label: string;
  value?: DraftAnswer;
  onChange: (patch: DraftAnswer) => void;
};

/** A question: its prompt, Yes / No / N/A, a reference when there is one, and remarks. */
function ItemRow({ item, label, value, onChange, compact }: RowProps & { compact?: boolean }) {
  const promptId = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Mono className="w-14 shrink-0 pt-0.5 text-[13px] text-gray-500">{label}</Mono>
        <Bilingual
          id={promptId}
          as="p"
          en={item.prompt_en}
          fil={item.prompt_fil}
          className={cn('min-w-0 flex-1 leading-[1.45]', compact ? 'text-[15px]' : 'text-[16px]')}
        />
      </div>
      <SegmentedControl
        name={`answer-${item.id}`}
        labelledBy={promptId}
        options={ANSWER_OPTIONS}
        value={value?.answer ?? ''}
        onChange={(answer) => onChange({ answer: answer as AnswerValue })}
      />
      {item.safe_answer === 'no' && (
        <p className="text-[13px] font-semibold text-warning-700">Yes here means a hazard</p>
      )}
      {item.reference && (
        <details className="text-[14px] text-gray-600">
          <summary className="cursor-pointer font-semibold text-gray-700">Reference</summary>
          <p className="mt-1.5 leading-[1.45]">{item.reference}</p>
        </details>
      )}
      <Remarks value={value?.remarks ?? ''} onChange={(remarks) => onChange({ remarks })} />
    </div>
  );
}

/** The shared prompt once, then one row per sub-item that applies, then the group's remarks. */
function GroupCard({ parent, items }: { parent: RowProps; items: RowProps[] }) {
  return (
    <Card className="flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <Mono className="w-14 shrink-0 pt-0.5 text-[13px] text-gray-500">{parent.label}</Mono>
        <Bilingual
          as="p"
          en={parent.item.prompt_en}
          fil={parent.item.prompt_fil}
          className="min-w-0 flex-1 text-[16px] leading-[1.45] font-semibold"
        />
      </div>
      <ul className="flex flex-col">
        {items.map((row) => (
          <li
            key={row.item.id}
            id={`item-${row.item.id}`}
            tabIndex={-1}
            className="scroll-mt-4 border-t border-line py-4 outline-none first:border-t-0 first:pt-0 focus-visible:ring-3 focus-visible:ring-[#5a9ef2]"
          >
            <ItemRow {...row} compact />
          </li>
        ))}
      </ul>
      <div className="border-t border-line pt-3">
        <Remarks
          label="Remarks on the whole group"
          value={parent.value?.remarks ?? ''}
          onChange={(remarks) => parent.onChange({ remarks })}
        />
      </div>
    </Card>
  );
}

function Remarks({
  label = 'Remarks',
  buttonLabel = 'Add remarks',
  value,
  onChange,
}: {
  label?: string;
  buttonLabel?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(value.trim() !== '');
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'self-start rounded-lg py-1 text-[14px] font-semibold text-brand-700 hover:underline',
          FOCUS_RING
        )}
      >
        {buttonLabel}
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <FieldLabel htmlFor={id} hint="Optional">
        {label}
      </FieldLabel>
      <TextArea
        id={id}
        maxLength={2000}
        value={value}
        autoFocus={value === ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-20"
      />
    </div>
  );
}
