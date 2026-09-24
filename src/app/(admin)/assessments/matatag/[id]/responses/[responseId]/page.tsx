'use client';

import { MatatagResponseDetail } from '@/components/matatag/matatag-response-detail';
import { useParams } from 'next/navigation';

export default function MatatagResponsePage() {
  const { id, responseId } = useParams<{ id: string; responseId: string }>();
  return (
    <MatatagResponseDetail
      formId={id}
      responseId={responseId}
      backHref={`/assessments/matatag/${id}`}
    />
  );
}
