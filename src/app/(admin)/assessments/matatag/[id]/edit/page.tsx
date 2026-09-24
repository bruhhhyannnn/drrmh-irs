'use client';

import { PageBreadcrumb } from '@/components/common/page-breadcrumb';
import { useMatatagForm, usePublishCampusMatatag } from '@/components/hooks/use-matatag';
import { MatatagTemplateEditor } from '@/components/matatag/template-editor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function EditCampusAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const form = useMatatagForm(id);
  const publish = usePublishCampusMatatag(id);
  if (!form.data)
    return (
      <div>
        <p role={form.error ? 'alert' : 'status'}>{form.error?.message || 'Loading assessment…'}</p>
        {form.error && <Button onClick={() => form.refetch()}>Try again</Button>}
      </div>
    );
  if (!form.data.canManage)
    return <p role="alert">Only your campus administrator or a Super Admin can edit this form.</p>;
  return (
    <>
      <PageBreadcrumb pageTitle={`Edit ${form.data.title}`} />
      <Link
        href={`/assessments/matatag/${id}`}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-300"
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to assessment and responses
      </Link>
      <section className="mb-5 flex items-start gap-4 rounded-xl border border-brand-100 bg-brand-25 p-5 dark:border-brand-900/60 dark:bg-brand-950/30">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f1e9] text-[#255f3c] dark:bg-[#20372a] dark:text-[#79c493]">
          <Building2 size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-semibold text-gray-950 dark:text-white">Campus checklist</h1>
          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Assigned to {form.data.campus.name}. Publishing changes updates this assessment only;
            existing responses keep their original questions.
          </p>
        </div>
      </section>
      <MatatagTemplateEditor
        initial={form.data.template}
        onPublish={publish.mutateAsync}
        previewHref={`/assessments/matatag/${id}/submit`}
      />
    </>
  );
}
