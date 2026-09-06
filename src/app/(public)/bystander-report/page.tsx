import { AuthHeader } from '@/components/auth';
import { Suspense } from 'react';
import { BystanderReportForm } from './bystander-report-form';

export default function ReportSubmitPage() {
  return (
    <AuthHeader maxWidth="xl" className=" bg-gray-50 dark:bg-gray-800">
      <Suspense>
        <BystanderReportForm />
      </Suspense>
    </AuthHeader>
  );
}
