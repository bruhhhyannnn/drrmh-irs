'use client';

import { MatatagResponseDetail } from '@/components/matatag/matatag-response-detail';
import { useParams } from 'next/navigation';

export default function GeneralMatatagResponsePage() {
  const { responseId } = useParams<{ responseId: string }>();
  return (
    <MatatagResponseDetail
      responseId={responseId}
      backHref="/assessments/matatag/general#responses"
    />
  );
}
