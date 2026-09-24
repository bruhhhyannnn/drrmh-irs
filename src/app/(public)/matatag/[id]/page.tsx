'use client';

import { MatatagForm } from '@/components/matatag/matatag-form';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

export default function SpecificMatatagPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Loading MATATAG assessment…
        </p>
      }
    >
      <MatatagForm suppliedFormId={id} />
    </Suspense>
  );
}
