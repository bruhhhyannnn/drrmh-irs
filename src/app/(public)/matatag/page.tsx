import { MatatagForm } from '@/components/matatag/matatag-form';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Digital MATATAG | UPM DRRM-H',
  description: 'Monitoring and Assessment Tool for Area Threats and Accident Generators.',
};

export default function MatatagPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Loading MATATAG…
        </p>
      }
    >
      <MatatagForm />
    </Suspense>
  );
}
