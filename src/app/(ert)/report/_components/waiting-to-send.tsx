'use client';

import { Button, Drawer, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import type { QueuedFieldReport } from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { AlertTriangle, Check, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDateTime, formatTime } from '../_lib/format';
import { queuedHeadcount, useFieldQueue } from '../_lib/use-field-queue';
import { DetailList, Dot, Mono, Pill } from './chrome';

/** How long the green "Sent" chip stays after a queued report goes through. */
const SENT_CHIP_MS = 5000;

/**
 * Top-bar chip shown on every ERT page while a report waits on this phone, so it isn't
 * forgotten. Tapping it lists the waiting reports with Try sending now. When the last one
 * sends, the chip turns green with the time for a few seconds, then goes away.
 */
export function WaitingToSend() {
  const entries = useFieldQueue();
  const lastFieldSyncAt = useOfflineQueueStore((s) => s.lastFieldSyncAt);
  const [open, setOpen] = useState(false);
  const [sentVisible, setSentVisible] = useState(false);

  useEffect(() => {
    // Only right after a send — not when the page is opened later.
    const remaining = lastFieldSyncAt ? SENT_CHIP_MS - (Date.now() - lastFieldSyncAt) : 0;
    if (remaining <= 0) return;
    setSentVisible(true);
    const timer = setTimeout(() => setSentVisible(false), remaining);
    return () => clearTimeout(timer);
  }, [lastFieldSyncAt]);

  const pending = entries.filter((e) => e.status === 'pending').length;
  const failed = entries.filter((e) => e.status === 'failed').length;

  let chip: React.ReactNode = null;
  if (pending > 0 || failed > 0) {
    const waiting = pending > 0;
    const count = waiting ? pending : failed;
    chip = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-11 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap',
          waiting
            ? 'bg-warning-50 border-[#fedf89] text-[#b54708] hover:bg-[#fef0c7]'
            : 'bg-error-50 border-[#fecdca] text-[#b42318] hover:bg-[#fee4e2]',
          FOCUS_RING
        )}
      >
        {waiting ? <WifiOff size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
        <span className="hidden md:inline">
          {count} {count === 1 ? 'report' : 'reports'} {waiting ? 'waiting to send' : 'not sent'}
        </span>
        <span className="md:hidden">
          {count} {waiting ? 'waiting' : 'not sent'}
        </span>
      </button>
    );
  } else if (sentVisible && lastFieldSyncAt) {
    chip = (
      <span
        role="status"
        className="bg-success-50 flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#abefc6] pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap text-[#027a48]"
      >
        <Check size={16} strokeWidth={2.5} aria-hidden />
        Sent · <Mono>{formatTime(lastFieldSyncAt)}</Mono>
      </span>
    );
  }

  return (
    <>
      {chip}
      <WaitingDrawer open={open} onClose={() => setOpen(false)} entries={entries} />
    </>
  );
}

function WaitingDrawer({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: QueuedFieldReport[];
}) {
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const lastAttemptAt = useOfflineQueueStore((s) => s.lastAttemptAt);
  const flushNow = useOfflineQueueStore((s) => s.flushNow);
  const hasPending = entries.some((e) => e.status === 'pending');

  // Closes on its own once everything has gone through.
  useEffect(() => {
    if (open && entries.length === 0) onClose();
  }, [open, entries.length, onClose]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Waiting to send"
      subtitle="Saved on this phone. Each report sends on its own when your connection returns."
      footer={
        <Button fullWidth loading={isSyncing} disabled={!hasPending} onClick={() => flushNow()}>
          {isSyncing ? 'Sending…' : 'Try sending now'}
        </Button>
      }
    >
      <ul className="flex flex-col gap-4">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-gray-200 p-4 shadow-[0_1px_3px_rgba(16,24,40,.06)]"
          >
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
                <span className="text-[15px] font-bold">
                  {entry.summary?.title ?? 'Status report'}
                </span>
                {entry.summary?.subtitle && (
                  <span className="text-[13px] text-gray-500">{entry.summary.subtitle}</span>
                )}
              </div>
              <QueueStatus entry={entry} isOnline={isOnline} isSyncing={isSyncing} />
            </div>
            <DetailList
              rows={[
                { label: 'Headcount', value: <Mono>{queuedHeadcount(entry)}</Mono> },
                {
                  label: 'Saved',
                  value: (
                    <Mono className="text-[13px] font-normal">
                      {formatDateTime(entry.createdAt)}
                    </Mono>
                  ),
                },
                {
                  label: 'Last try',
                  value: (
                    <Mono className="text-[13px] font-normal">
                      {lastAttemptAt ? formatTime(lastAttemptAt) : 'Not yet'}
                    </Mono>
                  ),
                },
              ]}
            />
            {entry.status === 'failed' && entry.errorMessage && (
              <p className="text-[13px] leading-[1.45] font-medium text-[#b42318]">
                {entry.errorMessage}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="bg-warning-50 flex items-start gap-2.5 rounded-2xl border border-[#fedf89] px-3.5 py-3 text-[14px] leading-normal font-medium text-[#93370d]">
        <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
        <span className="text-pretty">
          Keep this app installed, and don&apos;t clear its data, until this list is empty.
        </span>
      </div>
    </Drawer>
  );
}

function QueueStatus({
  entry,
  isOnline,
  isSyncing,
}: {
  entry: QueuedFieldReport;
  isOnline: boolean;
  isSyncing: boolean;
}) {
  if (entry.status === 'failed') {
    return (
      <Pill tone="error" icon={<Dot className="bg-error-500" />}>
        Couldn&apos;t send
      </Pill>
    );
  }
  return (
    <Pill tone="warning" icon={<Dot className="bg-warning-500" />}>
      {!isOnline ? 'Waiting for connection' : isSyncing ? 'Sending…' : 'Waiting to retry'}
    </Pill>
  );
}
