'use client';

import { PageBreadcrumb } from '@/components/common/page-breadcrumb';
import { useMatatagRecord } from '@/components/hooks/use-matatag';
import { Button } from '@/components/ui/button';
import { assessmentSections, matatagAnswerLabel, matatagScore, matatagTotals } from '@/lib/matatag';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

export function MatatagResponseDetail({
  formId,
  responseId,
  backHref,
}: {
  formId?: string;
  responseId: string;
  backHref: string;
}) {
  const record = useMatatagRecord(responseId, formId);
  if (!record.data) {
    return (
      <div>
        <p role={record.error ? 'alert' : 'status'}>
          {record.error?.message || 'Loading response…'}
        </p>
        {record.error && <Button onClick={() => record.refetch()}>Try again</Button>}
      </div>
    );
  }

  const document = record.data.document;
  const totals = matatagTotals(document);
  return (
    <div className="space-y-5 text-gray-900 dark:text-white">
      <PageBreadcrumb pageTitle="MATATAG Response" />
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-300"
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to responses
      </Link>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="border-l-4 border-brand-600 p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${record.data.status === 'COMPLETED' ? 'bg-success-50 text-success-600 dark:bg-success-500/15' : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15'}`}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {record.data.status === 'COMPLETED' ? 'Submitted' : 'Draft'}
              </span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                {document.details.buildings || 'Untitled response'}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {document.details.campus}{' '}
                {document.details.unit ? `- ${document.details.unit}` : ''}
              </p>
            </div>
            <div className="min-w-32 border-l border-gray-200 pl-5 text-right dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">Overall score</span>
              <strong className="mt-1 block text-3xl text-[#255f3c] dark:text-[#79c493]">
                {matatagScore(document)}
              </strong>
            </div>
          </div>
        </div>
        <dl className="grid border-t border-gray-100 bg-gray-50/70 sm:grid-cols-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 px-5 py-4">
            <UserRound size={18} className="text-gray-400" aria-hidden="true" />
            <div>
              <dt className="text-xs text-gray-500">Evaluator</dt>
              <dd className="text-sm font-medium">{document.details.evaluator || 'Unknown'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 border-gray-200 px-5 py-4 sm:border-x dark:border-gray-800">
            <CalendarDays size={18} className="text-gray-400" aria-hidden="true" />
            <div>
              <dt className="text-xs text-gray-500">Assessment date</dt>
              <dd className="text-sm font-medium">{document.details.date || 'Not recorded'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <Building2 size={18} className="text-gray-400" aria-hidden="true" />
            <div>
              <dt className="text-xs text-gray-500">Responses</dt>
              <dd className="text-sm font-medium">
                {totals.YES} Yes, {totals.NO} No, {totals.NA} N/A
              </dd>
            </div>
          </div>
        </dl>
      </section>
      {assessmentSections(document).map((section, index) => (
        <section
          key={section.id}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {index + 1}
              </span>
              <div>
                <h2 className="font-semibold text-gray-950 dark:text-white">{section.title}</h2>
                {section.translation && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {section.translation}
                  </p>
                )}
              </div>
            </div>
            <span className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm font-semibold text-[#255f3c] dark:border-gray-700 dark:bg-gray-900 dark:text-[#79c493]">
              {matatagScore(document, section.id)}
            </span>
          </header>
          <div className="divide-y divide-gray-100 px-5 dark:divide-gray-800">
            {section.items.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-6"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-6">
                    <span className="mr-2 text-brand-700 dark:text-brand-300">
                      {item.number}
                      {item.starred ? '*' : ''}.
                    </span>
                    {item.text.en}
                  </p>
                  {item.text.fil && (
                    <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      {item.text.fil}
                    </p>
                  )}
                </div>
                <span className="inline-flex h-fit min-h-9 items-center gap-2 self-start rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                  <ClipboardList size={15} aria-hidden="true" />
                  {matatagAnswerLabel(document, section.id, item, 'en')}
                </span>
                {document.remarks[item.id] && (
                  <p className="rounded-md bg-[#f2f0e9] px-3 py-2 text-sm md:col-span-2 dark:bg-gray-800/70">
                    <strong>Remarks:</strong> {document.remarks[item.id]}
                  </p>
                )}
              </article>
            ))}
          </div>
          {document.sections[section.id]?.comments && (
            <p className="mt-4 text-sm">
              <strong>Section comments:</strong> {document.sections[section.id].comments}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
