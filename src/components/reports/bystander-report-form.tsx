'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { ReportForm } from './report-form';
import { useCheckUserAuth } from '@/hooks/use-check-user-auth';

export function BystanderReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = searchParams?.get('title') ?? 'Report an Incident';
  const isAuthenticated = useCheckUserAuth();

  const handleClose = () => router.push('/report-select');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Anonymous bystander submission
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {/* Disclaimer */}
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/40">
            <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
              <span className="font-semibold">Anonymous submission.</span> Your identity will not be
              stored. For life-threatening emergencies, call{' '}
              <span className="font-semibold">911</span> immediately.
            </p>
          </div>

          <ReportForm
            onSuccess={handleClose}
            onCancel={handleClose}
            isBystander={!isAuthenticated}
          />
        </div>
      </div>
    </div>
  );
}
