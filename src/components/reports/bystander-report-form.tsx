'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ReportForm } from './report-form';
import { useCheckUserAuth } from '@/hooks/use-check-user-auth';

export function BystanderReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = searchParams?.get('title') ?? 'Report an Incident';
  const isAuthenticated = useCheckUserAuth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <button
        onClick={() => router.push('/report-select')}
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          Anonymous bystander submission
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/40">
        <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
          <span className="font-semibold">Anonymous submission.</span> Your identity will not be
          stored. For life-threatening emergencies, call <span className="font-semibold">911</span>{' '}
          immediately.
        </p>
      </div>

      <ReportForm
        onSuccess={() => router.push('/report-select')}
        onCancel={() => router.push('/report-select')}
        isBystander={!isAuthenticated}
      />
    </div>
  );
}
