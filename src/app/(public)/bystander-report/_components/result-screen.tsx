'use client';

import { ButtonLink, TextLink } from '@/app/(public)/_components/primitives';
import { Button } from '@/components/ds';
import { cn } from '@/lib';
import { format } from 'date-fns';
import { Check, Phone, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { photosLabel } from '../_lib/summary';
import { HeroBand, PageCard } from './chrome';

export interface ReportResult {
  kind: 'sent' | 'offline';
  /** ISO time the server saved it, or the device time it was queued. */
  at: string;
  /** "Fire · UP Manila, CCIS" */
  incident: string;
  photosChosen: number;
  /** How many photos the server kept (sent reports only). */
  photosSaved: number;
}

/** "Report received" and "Report saved offline" — one layout so they read as one pattern. */
export function ResultScreen({
  result,
  onSendAnother,
}: {
  result: ReportResult;
  onSendAnother: () => void;
}) {
  const isSent = result.kind === 'sent';
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, []);

  const photos =
    result.photosSaved === result.photosChosen
      ? photosLabel(result.photosSaved)
      : `${result.photosSaved} of ${result.photosChosen} sent`;

  return (
    <>
      <HeroBand className="h-30 md:h-40" />
      <PageCard className="mb-16 -mt-16 max-w-140 items-center gap-5 p-6 text-center md:-mt-24 md:p-10">
        <span
          className={cn(
            'grid size-16 place-items-center rounded-full',
            isSent ? 'bg-success-50 text-[#027a48]' : 'bg-warning-50 text-[#b54708]'
          )}
        >
          {isSent ? (
            <Check size={30} strokeWidth={2.5} aria-hidden />
          ) : (
            <WifiOff size={30} aria-hidden />
          )}
        </span>

        <div className="flex flex-col gap-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[22px] leading-[1.2] font-extrabold outline-none md:text-[26px]"
          >
            {isSent ? 'Report received' : 'Report saved offline'}
          </h1>
          <p className="text-[15px] leading-[1.55] text-pretty text-gray-600">
            {isSent
              ? 'Thank you. Your report has been received and will be reviewed by the DRRM-H Emergency Response Team.'
              : "No internet connection was found, so your report was saved on this device. It will be submitted automatically as soon as you're back online — you don't need to do anything else."}
          </p>
        </div>

        <dl className="flex flex-col self-stretch rounded-2xl border border-[#eaecf0] bg-gray-50 px-4 py-1 text-left text-[14px]">
          <SummaryRow label={isSent ? 'Sent' : 'Saved'}>
            <span className="font-landing-mono text-[13px]">
              {format(new Date(result.at), 'MMM d, yyyy · h:mm a')}
            </span>
          </SummaryRow>
          <SummaryRow label="Incident">
            <span className="font-semibold">{result.incident}</span>
          </SummaryRow>
          {isSent && (
            <SummaryRow label="Photos">
              <span className="font-semibold">{photos}</span>
            </SummaryRow>
          )}
          <SummaryRow label="Status" last>
            <span
              className={cn(
                'flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap',
                isSent ? 'bg-success-50 text-[#027a48]' : 'bg-warning-50 text-[#b54708]'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  isSent ? 'bg-success-500' : 'bg-warning-500'
                )}
              />
              {isSent ? 'Received' : 'Waiting for connection'}
            </span>
          </SummaryRow>
        </dl>

        {isSent ? (
          <div className="flex flex-wrap-reverse gap-3 self-stretch">
            <div className="flex flex-[1_1_200px] flex-col">
              <Button variant="outline" fullWidth onClick={onSendAnother}>
                Send another report
              </Button>
            </div>
            <div className="flex flex-[1_1_200px] flex-col">
              <ButtonLink href="/" fullWidth>
                Back to home
              </ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-2 text-[14px] text-gray-600">
              <Phone size={16} aria-hidden className="text-brand-500" />
              <span>
                Need help now? <TextLink href="tel:911">Call 911</TextLink>
              </span>
            </p>
            <div className="flex flex-col self-stretch">
              <ButtonLink href="/" fullWidth>
                Back to home
              </ButtonLink>
            </div>
          </>
        )}
      </PageCard>
    </>
  );
}

function SummaryRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2.5',
        !last && 'border-b border-[#eaecf0]'
      )}
    >
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
