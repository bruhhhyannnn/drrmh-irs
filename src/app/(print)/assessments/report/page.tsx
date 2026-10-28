'use client';

import { RecordPrint } from '@/app/(ert)/assessment/_components/assessment-print';
import { FOCUS_RING } from '@/components/ds';
import { useAdminAssessment } from '@/components/hooks/use-assessments';
import { PrintShell, PrintToolbar } from '@/components/print/report-sheet';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// A submitted assessment on A4 for admins (/assessments/report?id=): the same pages ERT members
// print from /assessment?print=, opened from the admin detail page.

export default function AssessmentReportPage() {
  return (
    <Suspense>
      <AssessmentReport />
    </Suspense>
  );
}

function AssessmentReport() {
  const id = useSearchParams().get('id') ?? undefined;
  const { data: record, isPending } = useAdminAssessment(id);
  const back = (
    <Link
      href={id ? `/assessments/details?id=${id}` : '/assessments'}
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-lg px-1 text-[14px] font-bold text-gray-600',
        FOCUS_RING
      )}
    >
      <ArrowLeft size={16} aria-hidden />
      Back to assessment
    </Link>
  );

  if (record) return <RecordPrint record={record} back={back} />;
  return (
    <PrintShell toolbar={<PrintToolbar label="Print" back={back} />}>
      {id && isPending ? (
        <Loader label="Preparing the assessment…" className="py-20" />
      ) : (
        <p className="mx-auto max-w-200 p-10 text-[15px] text-error-700">
          This assessment isn&apos;t available. It may have been deleted, or it belongs to another
          campus.
        </p>
      )}
    </PrintShell>
  );
}
