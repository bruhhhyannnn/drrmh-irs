import { BystanderReportForm } from '@/components/reports/bystander-report-form';
import { Suspense } from 'react';

export default function ReportSubmitPage() {
  return (
    <Suspense>
      <BystanderReportForm />
    </Suspense>
  );
}
