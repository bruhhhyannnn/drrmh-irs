'use client';

import { Button } from '@/components/ds';
import { eventSummarySourceQuery } from '@/components/hooks/use-events';
import { useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * Export NSED report: the campus's quarterly report as a Word file. The summary source is
 * fetched when asked (cached for the event page), so a list of events loads nothing extra.
 * `exporting` is the event being exported, if any.
 */
export function useExportNsed() {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportNsed = async (eventId: string) => {
    setExporting(eventId);
    try {
      const source = await queryClient.fetchQuery(eventSummarySourceQuery(eventId));
      if (!source) throw new Error('Event not found');
      const { downloadNsedReport } = await import('../../_lib/nsed-docx');
      await downloadNsedReport(source);
    } catch (err) {
      console.error(err);
      toast.error('Couldn’t make the NSED report. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return { exportNsed, exporting };
}

/** The header button on event details. */
export function ExportNsedButton({ eventId }: { eventId: string }) {
  const { exportNsed, exporting } = useExportNsed();
  const busy = exporting === eventId;
  return (
    <Button size="sm" variant="outline" onClick={() => exportNsed(eventId)} loading={busy}>
      {!busy && <FileText size={16} aria-hidden />}
      Export NSED report
    </Button>
  );
}
