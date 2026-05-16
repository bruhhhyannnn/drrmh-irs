import { AuthHeader } from '@/components/auth';
import { BystanderReportForm } from '@/components/reports/bystander-report-form';
import { Suspense } from 'react';

export default function ReportSubmitPage() {
  return (
    <AuthHeader>
      <Suspense>
        <BystanderReportForm />
      </Suspense>
    </AuthHeader>
  );
}
