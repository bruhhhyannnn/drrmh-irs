'use client';

import { PageBreadcrumb } from '@/components/common/page-breadcrumb';
import { useMatatagTemplate, usePublishMatatagTemplate } from '@/components/hooks/use-matatag';
import { MatatagTemplateEditor } from '@/components/matatag/template-editor';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { ClipboardCheck, ShieldCheck } from 'lucide-react';

export default function DefaultTemplatePage() {
  const profile = useAuthStore((s) => s.userProfile);
  return (
    <>
      <PageBreadcrumb pageTitle="Default MATATAG Template" />
      {profile?.is_active && profile.user_type.name === 'Super Admin' ? (
        <DefaultTemplate />
      ) : (
        <p role="alert">Only Super Admin users can edit the default template.</p>
      )}
    </>
  );
}

function DefaultTemplate() {
  const template = useMatatagTemplate();
  const publish = usePublishMatatagTemplate();
  if (!template.data)
    return (
      <div>
        <p role={template.error ? 'alert' : 'status'}>
          {template.error?.message || 'Loading default template…'}
        </p>
        {template.error && <Button onClick={() => template.refetch()}>Try again</Button>}
      </div>
    );
  const questionCount = template.data.definition.sections.reduce(
    (total, section) => total + section.items.length,
    0
  );
  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-xl bg-brand-800 px-6 py-7 text-white shadow-theme-sm md:px-8 md:py-8">
        <div className="absolute inset-y-0 left-0 w-28 bg-[#255f3c] [clip-path:polygon(0_0,100%_0,58%_100%,0_100%)]" />
        <div className="relative z-10 ml-12 max-w-3xl md:ml-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-brand-100">
            <ShieldCheck size={15} aria-hidden="true" />
            Super Admin workspace
          </div>
          <h1 className="max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
            Default MATATAG checklist
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-100 md:text-base">
            Edit the source checklist for future campus assessments. Published revisions never
            change existing forms or saved responses.
          </p>
        </div>
        <ClipboardCheck
          className="absolute -right-4 -bottom-10 hidden size-52 text-white/[0.06] md:block"
          aria-hidden="true"
        />
      </section>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sections</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {template.data.definition.sections.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Questions</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {questionCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Current revision</p>
          <p className="mt-1 text-2xl font-semibold text-brand-700 dark:text-brand-300">
            v{template.data.revision}
          </p>
        </div>
      </div>
      <MatatagTemplateEditor initial={template.data} onPublish={publish.mutateAsync} />
    </>
  );
}
