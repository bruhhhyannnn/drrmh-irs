'use client';

import { AssessmentRecordBody } from '@/app/(ert)/assessment/_components/assessment-view';
import { Button } from '@/components/ds';
import { useAdminAssessment, useDeleteAssessment } from '@/components/hooks/use-assessments';
import { Printer, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { PageHeader } from '../../_components/page-header';
import { useIsSuperAdmin } from '../../_components/shell/campus-switcher';
import { Card, Chip, Skeleton } from '../../_components/ui';
import { formatDate } from '../../_lib/format';

export default function AssessmentDetailsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <AssessmentDetails />
    </Suspense>
  );
}

const BACK = { href: '/assessments', label: 'Assessments' };

/** One submitted assessment, read-only, as the evaluator sees it; Super Admins can delete it. */
function AssessmentDetails() {
  const router = useRouter();
  const id = useSearchParams().get('id') ?? undefined;
  const { data: record, isPending } = useAdminAssessment(id);
  const remove = useDeleteAssessment();
  const isSuperAdmin = useIsSuperAdmin();
  const [deleting, setDeleting] = useState(false);

  if (id && isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-20 w-full max-w-140" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  // The server returns nothing for another campus, so out of scope reads as not found.
  if (!record) {
    return (
      <>
        <PageHeader title="Assessment not found" back={BACK} />
        <Card className="p-8 text-[17px] text-gray-600">
          This assessment doesn&apos;t exist anymore. It may have been deleted.
        </Card>
      </>
    );
  }

  const printPdf = () => window.open(`/assessments/report?id=${record.id}`, '_blank', 'noopener');

  return (
    <>
      <PageHeader
        title={record.building_name}
        subtitle={`${record.unit_name} · ${record.cluster_name} · ${formatDate(record.ended_at)}`}
        back={BACK}
        chip={
          record.needs_follow_up ? (
            <Chip tone="amber" dot>
              Needs follow-up
            </Chip>
          ) : undefined
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={printPdf}>
              <Printer size={16} aria-hidden />
              Print
            </Button>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
                <Trash2 size={16} aria-hidden />
                Delete
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-5">
        <AssessmentRecordBody record={record} />
      </div>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(record.id, {
            onSuccess: () => {
              toast.success('Assessment deleted');
              router.push('/assessments');
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={remove.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this assessment?"
        name={`${record.building_name}, ${formatDate(record.ended_at)}`}
        body="will be permanently deleted with its answers and scores. This cannot be undone."
        confirmLabel="Delete assessment"
      />
    </>
  );
}
