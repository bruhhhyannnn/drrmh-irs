'use client';

import { useOfflineReportSync } from '@/hooks/use-offline-report-queue';

export function OfflineReportSync() {
  useOfflineReportSync();
  return null;
}
