'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { FieldLabel, FOCUS_RING, SegmentedControl, TextArea } from '@/components/ds';
import { cn } from '@/lib';
import { sectionProgress, type DraftAnswer } from '@/lib/assessment-draft';
import { applicableItems } from '@/lib/assessment-score';
import {
  itemLabel,
  type AnswerValue,
  type TemplateItem,
  type TemplateSection,
} from '@/lib/assessment-template';
import { useId, useState } from 'react';
import { Card, Mono } from '../../_components/chrome';
import type { StepProps } from './details-step';

const ANSWER_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
];

/** One checklist section: every question that applies, in the paper form's order. */
export function SectionStep({
  template,
  draft,
  update,
  section,
}: StepProps & { section: TemplateSection }) {
  const commentId = useId();
  const applies = new Set(
    applicableItems(template, draft.floor_count, draft.area_type_ids).map((i) => i.id)
  );
  const items = section.items.filter((i) => applies.has(i.id));
  const topLevel = items.filter((i) => i.parent_id === null);
  const progress = sectionProgress(template, draft)[section.id] ?? { answered: 0, total: 0 };

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
    <div className="flex flex-col gap-4">
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
  value,
  onChange,
}: {
  label?: string;
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
        Add remarks
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
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
