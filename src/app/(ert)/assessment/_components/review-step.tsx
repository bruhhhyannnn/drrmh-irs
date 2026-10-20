'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Banner, Button, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import type { DraftStep } from '@/lib/assessment-draft';
import { scoreAssessment, type AnswerMap } from '@/lib/assessment-score';
import { itemLabel, type TemplateItem } from '@/lib/assessment-template';
import { assessmentDetailsSchema } from '@/lib/schemas';
import { useOfflineQueueStore } from '@/store';
import { ChevronRight } from 'lucide-react';
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
        <Card className="flex flex-col gap-4 p-5 md:p-6">
          <h3 className="text-[18px] font-bold">
            <Mono>{missing}</Mono> {missing === 1 ? 'question still needs' : 'questions still need'}{' '}
            an answer
          </h3>
          {unanswered.map(({ section, items }) => (
            <div key={section.id} className="flex flex-col gap-1.5">
              <div className="flex gap-2 text-[14px] font-semibold text-gray-600">
                <Mono className="shrink-0">{section.code}</Mono>
                <Bilingual en={section.title_en} fil={section.title_fil} className="min-w-0" />
              </div>
              <ul className="flex flex-col">
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
            </div>
          ))}
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
        {parentPrompt ? `${parentPrompt} — ${item.prompt_en}` : item.prompt_en}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
    </button>
  );
}
