'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Banner, Button, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import type { DraftStep } from '@/lib/assessment-draft';
import { scoreAssessment, type AnswerMap } from '@/lib/assessment-score';
import { itemLabel, type TemplateItem } from '@/lib/assessment-template';
import { assessmentDetailsSchema } from '@/lib/schemas';
import { useOfflineQueueStore } from '@/store';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Mono } from '../../_components/chrome';
import type { StepProps } from './details-step';
import { ScoreSummary } from './score-summary';

/** Scores so far, what's still unanswered, and Submit (or Save to send later, offline). */
export function ReviewStep({
  template,
  draft,
  onJump,
  onOpenStep,
  onSubmit,
  submitting,
  error,
}: StepProps & {
  onJump: (sectionId: string, itemId: string) => void;
  onOpenStep: (step: DraftStep) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string;
}) {
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const answers: AnswerMap = Object.fromEntries(
    Object.entries(draft.answers).map(([itemId, a]) => [itemId, a.answer])
  );
  const score = scoreAssessment(template, draft.floor_count, draft.area_type_ids, answers);
  const detailsOk = assessmentDetailsSchema.safeParse({
    cluster_id: draft.cluster_id,
    unit_id: draft.unit_id,
    building_id: draft.building_id,
    new_building_name: draft.new_building_name,
    incident_commander: draft.incident_commander,
    event_id: draft.event_id,
  }).success;

  const unanswered = template.sections
    .map((section) => ({
      section,
      items: score.unanswered.filter((i) => i.section_id === section.id),
    }))
    .filter((g) => g.items.length > 0);
  const missing = score.unanswered.length;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[22px] font-extrabold">Review</h2>

      {!detailsOk && (
        <Banner tone="warning">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Choose the cluster, unit and building first.
            <button
              type="button"
              onClick={() => onOpenStep('details')}
              className={cn('rounded font-bold underline', FOCUS_RING)}
            >
              Go to Details
            </button>
          </span>
        </Banner>
      )}

      <ScoreSummary score={score} template={template} />

      {missing > 0 && (
        <Card className="flex flex-col gap-3 p-5 md:p-6">
          <h3 className="text-[18px] font-bold">
            <Mono>{missing}</Mono> {missing === 1 ? 'question still needs' : 'questions still need'}{' '}
            an answer
          </h3>
          <div className="flex flex-col gap-2">
            {unanswered.map(({ section, items }) => (
              <details
                key={section.id}
                className="group rounded-2xl border border-line bg-gray-50/50"
              >
                <summary
                  className={cn(
                    'flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[15px] font-semibold text-gray-800 select-none [&::-webkit-details-marker]:hidden',
                    FOCUS_RING
                  )}
                >
                  <Mono className="bg-brand-25 text-brand-500 grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1.5 text-[12px] font-bold">
                    {section.code}
                  </Mono>
                  <Bilingual
                    en={section.title_en}
                    fil={section.title_fil}
                    className="min-w-0 flex-1 leading-[1.35]"
                  />
                  <Mono className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-bold text-gray-600">
                    {items.length} left
                  </Mono>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    className="shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <ul className="flex flex-col border-t border-line bg-surface p-1.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <UnansweredButton
                        label={itemLabel(section, item)}
                        item={item}
                        parentPrompt={
                          item.parent_id
                            ? section.items.find((p) => p.id === item.parent_id)?.prompt_en
                            : undefined
                        }
                        onClick={() => onJump(section.id, item.id)}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Card>
      )}

      {error && <Banner>{error}</Banner>}

      <Button
        fullWidth
        onClick={onSubmit}
        loading={submitting}
        disabled={missing > 0 || !detailsOk || submitting}
      >
        {isOnline ? 'Submit assessment' : 'Save to send later'}
      </Button>
      {!isOnline && (
        <p className="-mt-2 text-center text-[14px] text-gray-600">
          You&apos;re offline. It sends on its own when you&apos;re back online.
        </p>
      )}
    </div>
  );
}

function UnansweredButton({
  label,
  item,
  parentPrompt,
  onClick,
}: {
  label: string;
  item: TemplateItem;
  parentPrompt?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[15px] hover:bg-gray-50',
        FOCUS_RING
      )}
    >
      <Mono className="w-14 shrink-0 text-[13px] text-gray-500">{label}</Mono>
      <span className="line-clamp-2 min-w-0 flex-1">
        {parentPrompt ? (
          <>
            <span className="font-semibold text-gray-900">{item.prompt_en}</span>
            <span className="text-gray-500"> — {parentPrompt}</span>
          </>
        ) : (
          item.prompt_en
        )}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
    </button>
  );
}
