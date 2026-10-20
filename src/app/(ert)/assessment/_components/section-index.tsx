'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { sectionProgress, type AssessmentDraft, type DraftStep } from '@/lib/assessment-draft';
import type { AssessmentTemplate } from '@/lib/assessment-template';
import { Check } from 'lucide-react';
import { Mono, Pill } from '../../_components/chrome';

/** Every step of the form, with how far each section has got. Tapping a row opens that step. */
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
  onOpen: (step: DraftStep) => void;
}) {
  const progress = sectionProgress(template, draft);
  const sections = new Map(template.sections.map((s) => [s.id, s]));

  return (
    <nav aria-label="Assessment steps">
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const isCurrent = step === current;
          let content: React.ReactNode;
          if (step === 'details') content = <span className="flex-1">Details</span>;
          else if (step === 'building')
            content = <span className="flex-1">About the building</span>;
          else if (step === 'review') content = <span className="flex-1">Review</span>;
          else {
            const sectionId = step.slice('section:'.length);
            const section = sections.get(sectionId);
            const p = progress[sectionId] ?? { answered: 0, total: 0 };
            const done = p.total > 0 && p.answered === p.total;
            content = (
              <>
                <span className="flex min-w-0 flex-1 gap-2">
                  <Mono className="w-9 shrink-0 font-semibold text-gray-500">{section?.code}</Mono>
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
            <li key={step}>
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
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
