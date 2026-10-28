'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Button, FOCUS_RING } from '@/components/ds';
import { useMyAssessment } from '@/components/hooks/use-assessments';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib';
import { applicableItems, scoreAssessment, type AnswerMap } from '@/lib/assessment-score';
import {
  itemLabel,
  type AnswerValue,
  type AssessmentRecord,
  type TemplateItem,
  type TemplateSection,
} from '@/lib/assessment-template';
import { useOfflineQueueStore } from '@/store';
import { ArrowLeft, ChevronDown, FileQuestion, Printer, WifiOff } from 'lucide-react';
import {
  Card,
  DetailList,
  Dot,
  GUTTER,
  Hero,
  Mono,
  NoticeCard,
  Pill,
} from '../../_components/chrome';
import { formatDate, formatDateTime } from '../../_lib/format';
import { AssessmentLink, goToAssessment } from '../_lib/nav';
import { ScoreSummary } from './score-summary';

/** One submitted assessment, read-only: details, scores, then every answer by section. */
export function AssessmentView({ id }: { id: string }) {
  const record = useMyAssessment(id);
  const isOnline = useOfflineQueueStore((s) => s.isOnline);

  if (record.isPending) {
    if (!isOnline) {
      return (
        <NoticeCard
          icon={<WifiOff size={28} aria-hidden />}
          iconTone="warning"
          title="You're offline"
          description="Connect to see this assessment."
        >
          <BackButton />
        </NoticeCard>
      );
    }
    return <Loader label="Loading the assessment…" className="flex-1 py-20" />;
  }
  if (!record.data) {
    return (
      <NoticeCard
        icon={<FileQuestion size={28} aria-hidden />}
        iconTone="neutral"
        title="This assessment isn't available."
        description="It may belong to another account, or the link is incomplete."
      >
        <BackButton />
      </NoticeCard>
    );
  }
  return <RecordView record={record.data} />;
}

function BackButton() {
  return (
    <Button variant="outline" onClick={() => goToAssessment('')}>
      Back to assessments
    </Button>
  );
}

const ANSWER_TEXT: Record<AnswerValue, string> = { yes: 'Yes', no: 'No', na: 'N/A' };

function isUnsafe(item: TemplateItem, value: AnswerValue | null | undefined) {
  return item.is_scored && value != null && value !== 'na' && value !== item.safe_answer;
}

function RecordView({ record }: { record: AssessmentRecord }) {
  return (
    <>
      <Hero eyebrow="Building assessment" title={record.building_name}>
        <span className="text-[15px] font-semibold text-white/85">
          {formatDate(record.ended_at)}
        </span>
        {record.needs_follow_up && (
          <Pill tone="warning" icon={<Dot className="bg-warning-500" />}>
            Needs follow-up
          </Pill>
        )}
      </Hero>

      <main className={cn(GUTTER, 'flex flex-col gap-5 py-6 md:py-8')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AssessmentLink
            query=""
            className={cn(
              'flex items-center gap-1.5 rounded-lg py-1 text-[15px] font-semibold text-brand-700 hover:underline',
              FOCUS_RING
            )}
          >
            <ArrowLeft size={18} aria-hidden />
            Back to assessments
          </AssessmentLink>
          <Button variant="outline" size="sm" onClick={() => goToAssessment(`?print=${record.id}`)}>
            <Printer size={16} aria-hidden />
            Print
          </Button>
        </div>

        <AssessmentRecordBody record={record} />
      </main>
    </>
  );
}

/**
 * The details, scores and every answer of a submitted assessment. Also the body of the admin
 * detail page (/assessments/details), which wraps it in its own header.
 */
export function AssessmentRecordBody({ record }: { record: AssessmentRecord }) {
  const { template } = record;
  const answers: AnswerMap = Object.fromEntries(
    Object.entries(record.answers).map(([itemId, a]) => [itemId, a.answer])
  );
  const score = scoreAssessment(template, record.floor_count, record.area_type_ids, answers);
  const items = applicableItems(template, record.floor_count, record.area_type_ids);
  const applies = new Set(items.map((i) => i.id));
  const sections = template.sections.filter((s) => s.items.some((i) => applies.has(i.id)));
  const ticked = new Set(record.area_type_ids);
  const notTicked = template.area_types.filter((a) => !ticked.has(a.id)).map((a) => a.name_en);

  return (
    <>
      <DetailList
        rows={[
          { label: 'Building', value: record.building_name },
          { label: 'College or unit', value: record.unit_name },
          { label: 'Cluster', value: record.cluster_name },
          { label: 'Evaluator', value: record.evaluator_name || '—' },
          { label: 'Incident commander', value: record.incident_commander || '—' },
          { label: 'Event', value: record.event_name ?? 'None' },
          { label: 'Started', value: <Mono>{formatDateTime(record.started_at)}</Mono> },
          { label: 'Ended', value: <Mono>{formatDateTime(record.ended_at)}</Mono> },
          { label: 'Floors', value: <Mono>{record.floor_count}</Mono> },
        ]}
      />

      <h2 className="pt-2 text-[22px] font-extrabold">Scores</h2>
      <ScoreSummary score={score} template={template} />

      <h2 className="pt-2 text-[22px] font-extrabold">Answers</h2>
      {notTicked.length > 0 && (
        <p className="text-[15px] text-gray-600">Not applicable (no {notTicked.join(', ')})</p>
      )}
      {sections.map((section) => (
        <SectionAnswers
          key={section.id}
          section={section}
          items={section.items.filter((i) => applies.has(i.id))}
          record={record}
        />
      ))}
    </>
  );
}

function SectionAnswers({
  section,
  items,
  record,
}: {
  section: TemplateSection;
  items: TemplateItem[];
  record: AssessmentRecord;
}) {
  const comment = record.comments[section.id];
  const unsafe = items.filter((item) => isUnsafe(item, record.answers[item.id]?.answer)).length;
  return (
    <Card className="p-0">
      <details className="group flex flex-col">
        <summary
          className={cn(
            'flex cursor-pointer list-none items-start gap-3 rounded-[22px] p-5 select-none md:p-6 [&::-webkit-details-marker]:hidden',
            FOCUS_RING
          )}
        >
          <Mono className="bg-brand-25 text-brand-500 grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-1.5 text-[14px] font-semibold">
            {section.code}
          </Mono>
          <Bilingual
            as="h3"
            en={section.title_en}
            fil={section.title_fil}
            className="min-w-0 flex-1 text-[18px] leading-[1.3] font-bold"
          />
          {unsafe > 0 && (
            <Pill tone="error" icon={<Dot className="bg-error-500" />}>
              {unsafe} unsafe
            </Pill>
          )}
          <ChevronDown
            size={20}
            aria-hidden
            className="mt-1 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col px-5 pb-5 md:px-6 md:pb-6">
          <ul className="flex flex-col">
            {items.map((item) => (
              <ItemAnswer
                key={item.id}
                label={itemLabel(section, item)}
                item={item}
                answer={record.answers[item.id]}
              />
            ))}
          </ul>
          {comment && (
            <div className="mt-3 rounded-2xl border border-line bg-gray-50 px-4 py-3 text-[15px]">
              <span className="block text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
                Comment
              </span>
              {comment}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

function ItemAnswer({
  label,
  item,
  answer,
}: {
  label: string;
  item: TemplateItem;
  answer?: { answer: AnswerValue | null; remarks: string | null };
}) {
  const value = answer?.answer ?? null;
  const unsafe = isUnsafe(item, value);
  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0',
        item.parent_id && 'pl-5'
      )}
    >
      <div className="flex items-start gap-3">
        <Mono className="w-14 shrink-0 pt-0.5 text-[13px] text-gray-500">{label}</Mono>
        <Bilingual
          en={item.prompt_en}
          fil={item.prompt_fil}
          className={cn(
            'min-w-0 flex-1 text-[15px] leading-[1.45]',
            !item.is_scored && 'font-semibold'
          )}
        />
        {item.is_scored &&
          (value === null ? (
            <span className="text-[14px] text-gray-400">—</span>
          ) : unsafe ? (
            <Pill tone="error" icon={<Dot className="bg-error-500" />}>
              {ANSWER_TEXT[value]}
            </Pill>
          ) : value === 'na' ? (
            <span className="pt-0.5 text-[14px] font-semibold text-gray-500">N/A</span>
          ) : (
            <Pill tone="success">{ANSWER_TEXT[value]}</Pill>
          ))}
      </div>
      {answer?.remarks && (
        <p className="ml-17 text-[14px] text-gray-600">
          <span className="font-semibold">Remarks:</span> {answer.remarks}
        </p>
      )}
    </li>
  );
}
