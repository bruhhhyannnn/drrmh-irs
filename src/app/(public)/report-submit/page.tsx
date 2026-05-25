import { AuthHeader } from '@/components/auth';
import { BystanderReportForm } from '@/components/reports';
import { Suspense } from 'react';

export default function ReportSubmitPage() {
  return (
    <AuthHeader maxWidth="xl">
      <Suspense>
        <BystanderReportForm />
      </Suspense>
    </AuthHeader>
  );
}
