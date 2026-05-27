import { AuthHeader } from '@/components/auth';
import { Suspense } from 'react';
import { BystanderReportForm } from './bystander-report-form';

export default function ReportSubmitPage() {
  return (
    <AuthHeader maxWidth="xl">
      <Suspense>
        <BystanderReportForm />
      </Suspense>
    </AuthHeader>
  );
}
