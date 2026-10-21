'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { FOCUS_RING } from '@/components/ds';
import { useDebounced } from '@/components/hooks/use-debounced';
import { cn } from '@/lib';
import {
  activeSectionItem,
  answerFilterOf,
  searchQuestions,
  sectionProgress,
  type AnswerFilter,
  type AssessmentDraft,
  type DraftStep,
  type QuestionMatch,
} from '@/lib/assessment-draft';
import {
  itemLabel,
  type AnswerValue,
  type AssessmentTemplate,
  type TemplateItem,
} from '@/lib/assessment-template';
import { Check, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dot, Mono, Pill } from '../../_components/chrome';

/** How long typing has to pause before the questions are searched. */
const SEARCH_DEBOUNCE_MS = 250;

/** The answer filters, and what to say when one has nothing in it. */
const FILTERS: { value: AnswerFilter; label: string; empty: string }[] = [
  { value: 'all', label: 'All', empty: '' },
  { value: 'unanswered', label: 'Not answered', empty: 'Every question here is answered.' },
  { value: 'yes', label: 'Yes', empty: 'No question here is answered Yes.' },
  { value: 'no', label: 'No', empty: 'No question here is answered No.' },
  { value: 'na', label: 'N/A', empty: 'No question here is answered N/A.' },
];

/**
 * Every step of the form, with how far each section has got, under a search box that finds a
 * question by its words ("bathrooms", "palikuran") or its label, and answer filters that list the
 * questions still to do or answered one way. Tapping a row opens it.
 */
export function SectionIndex({
  template,
  draft,
  steps,
  current,
  grown,
  onOpen,
}: {
  template: AssessmentTemplate;
  draft: AssessmentDraft;
  steps: DraftStep[];
  current: DraftStep;
  grown: Set<string>;
  onOpen: (step: DraftStep, itemId?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AnswerFilter>('all');
  const input = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const progress = sectionProgress(template, draft);
  const sections = new Map(template.sections.map((s) => [s.id, s]));

  // Clearing the box brings the steps back at once; only the search itself waits.
  const searched = query.trim() ? debounced.trim() : '';
  const found = searchQuestions(template, draft, searched);
  const counts: Record<AnswerFilter, number> = {
    all: found.length,
    unanswered: 0,
    yes: 0,
    no: 0,
    na: 0,
  };
  for (const m of found) counts[answerFilterOf(draft, m.item.id)] += 1;
  const listing = searched !== '' || filter !== 'all';
  const shown =
    filter === 'all' ? found : found.filter((m) => answerFilterOf(draft, m.item.id) === filter);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-[14px] border border-gray-300 bg-surface px-3.5 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]">
        <Search size={18} aria-hidden className="shrink-0 text-gray-500" />
        <span className="sr-only">Search questions</span>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions, e.g. bathrooms"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-gray-900 outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
            aria-label="Clear search"
            className={cn(
              '-mr-1.5 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-50',
              FOCUS_RING
            )}
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </label>

      <div
        role="group"
        aria-label="Show questions"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
      >
        {FILTERS.map((f) => {
          const on = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold whitespace-nowrap transition-colors',
                on
                  ? 'bg-brand-solid border-transparent text-white'
                  : 'border-gray-300 bg-surface text-gray-700 hover:bg-gray-50',
                FOCUS_RING
              )}
            >
              {f.label}
              <Mono className={cn('text-[12px]', on ? 'text-white/80' : 'text-gray-500')}>
                {counts[f.value]}
              </Mono>
            </button>
          );
        })}
      </div>

      <p role="status" className="sr-only">
        {listing && `${shown.length} ${shown.length === 1 ? 'question' : 'questions'}`}
      </p>

      {listing ? (
        shown.length > 0 ? (
          <QuestionList matches={shown} draft={draft} onOpen={onOpen} />
        ) : (
          <p className="px-3 py-6 text-center text-[14px] leading-[1.45] text-gray-500">
            {found.length === 0 ? (
              <>
                No questions match &ldquo;{searched}&rdquo;. Questions for areas not ticked on About
                the building don&rsquo;t show here.
              </>
            ) : (
              FILTERS.find((f) => f.value === filter)?.empty
            )}
          </p>
        )
      ) : (
        <nav aria-label="Assessment steps">
          <ol className="flex flex-col gap-1">
            {steps.map((step) => {
              const isCurrent = step === current;
              let content: React.ReactNode;
              let activeQuestions: ReturnType<typeof activeSectionItem> = null;
              if (step === 'details') content = <span className="flex-1">Details</span>;
              else if (step === 'building')
                content = <span className="flex-1">About the building</span>;
              else if (step === 'review') content = <span className="flex-1">Review</span>;
              else {
                const sectionId = step.slice('section:'.length);
                const section = sections.get(sectionId);
                const p = progress[sectionId] ?? { answered: 0, total: 0 };
                const done = p.total > 0 && p.answered === p.total;
                if (isCurrent) activeQuestions = activeSectionItem(template, draft, sectionId);
                content = (
                  <>
                    <span className="flex min-w-0 flex-1 gap-2">
                      <Mono className="w-9 shrink-0 font-semibold text-gray-500">
                        {section?.code}
                      </Mono>
                      {section && (
                        <Bilingual
                          en={section.title_en}
                          fil={section.title_fil}
                          className="min-w-0 flex-1"
                        />
                      )}
                    </span>
                    {grown.has(sectionId) && <Pill tone="warning">New questions</Pill>}
                    <span
                      className={cn(
                        'flex shrink-0 items-center gap-1 text-[13px]',
                        done ? 'text-success-700' : 'text-gray-500'
                      )}
                    >
                      {done && <Check size={14} strokeWidth={3} aria-label="Complete" />}
                      <Mono>
                        {p.answered}/{p.total}
                      </Mono>
                    </span>
                  </>
                );
              }
              return (
                <li key={step} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => onOpen(step)}
                    className={cn(
                      'flex min-h-11 w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] leading-[1.35]',
                      isCurrent ? 'bg-brand-25 font-bold text-gray-900' : 'hover:bg-gray-50',
                      FOCUS_RING
                    )}
                  >
                    {content}
                  </button>
                  {activeQuestions && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {activeQuestions.items.map((q, idx) => {
                        const isActiveItem = q.id === activeQuestions.item.id;
                        const isAnswered = Boolean(draft.answers[q.id]?.answer);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            aria-label={`Question ${idx + 1}`}
                            aria-current={isActiveItem ? 'true' : undefined}
                            onClick={() => onOpen(step, q.id)}
                            className={cn(
                              'font-landing-mono grid size-9 place-items-center rounded-xl border text-[13px] transition-colors',
                              isActiveItem
                                ? 'bg-brand-solid border-transparent font-bold text-white'
                                : isAnswered
                                  ? 'border-success-300 bg-success-50 font-semibold text-success-700'
                                  : 'border-gray-200 bg-surface text-gray-600 hover:bg-gray-50',
                              FOCUS_RING
                            )}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}

/** Matching questions, each with its label, its group's shared prompt and its answer so far. */
function QuestionList({
  matches,
  draft,
  onOpen,
}: {
  matches: QuestionMatch[];
  draft: AssessmentDraft;
  onOpen: (step: DraftStep, itemId?: string) => void;
}) {
  return (
    <ul aria-label="Matching questions" className="flex flex-col gap-1">
      {matches.map(({ step, section, item, parent }) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(step, item.id)}
            className={cn(
              'flex min-h-11 w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] leading-[1.35] hover:bg-gray-50',
              FOCUS_RING
            )}
          >
            <Mono className="w-16 shrink-0 pt-px text-[13px] text-gray-500">
              {itemLabel(section, item)}
            </Mono>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {parent && (
                <Bilingual
                  en={parent.prompt_en}
                  fil={parent.prompt_fil}
                  className="line-clamp-2 text-[13px] text-gray-500"
                />
              )}
              <Bilingual en={item.prompt_en} fil={item.prompt_fil} />
            </span>
            <AnswerBadge item={item} answer={draft.answers[item.id]?.answer} />
          </button>
        </li>
      ))}
    </ul>
  );
}

const ANSWER_TEXT: Record<AnswerValue, string> = { yes: 'Yes', no: 'No', na: 'N/A' };

/** The answer so far, coloured by what it means: safe, a hazard, not applicable, or not yet. */
function AnswerBadge({ item, answer }: { item: TemplateItem; answer?: AnswerValue | null }) {
  if (!answer) {
    return (
      <span className="flex h-6.5 shrink-0 items-center rounded-full border border-dashed border-gray-300 px-2.5 text-[13px] font-semibold whitespace-nowrap text-gray-500">
        Not yet
      </span>
    );
  }
  if (answer === 'na') return <Pill tone="neutral">N/A</Pill>;
  if (answer !== item.safe_answer) {
    return (
      <Pill tone="error" icon={<Dot className="bg-error-500" />}>
        {ANSWER_TEXT[answer]}
      </Pill>
    );
  }
  return (
    <Pill tone="success" icon={<Check size={12} strokeWidth={3} aria-hidden />}>
      {ANSWER_TEXT[answer]}
    </Pill>
  );
}
