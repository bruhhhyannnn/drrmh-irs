'use client';

import { cn } from '@/lib';
import { RATE_APP_URL } from '@/lib/rate-app';
import { useRateAppStore } from '@/store';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { ExternalLink, Star, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Button } from './fields';
import { FOCUS_RING } from './focus';

/**
 * "Rate the DRRM-H IRS", over the page after a report sends from this device (straight away, or
 * when a report saved offline goes through). Rate the app opens the evaluation in Google Forms
 * in a new tab and stops it asking; Not now and the close button wait for the next report. A
 * centred card on tablet and web, a bottom sheet on phone.
 */
export function RateAppDialog({ inAccountMenu = false }: { inAccountMenu?: boolean }) {
  const asking = useRateAppStore((s) => s.asking);
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{asking && <RatePanel inAccountMenu={inAccountMenu} />}</AnimatePresence>
    </MotionConfig>
  );
}

function RatePanel({ inAccountMenu }: { inAccountMenu: boolean }) {
  const dismiss = useRateAppStore((s) => s.dismiss);
  const markRated = useRateAppStore((s) => s.markRated);
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-start md:justify-center md:px-4 md:pt-35"
      onKeyDown={onKeyDown}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgba(16,24,40,.55)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={dismiss}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative flex max-h-full w-full flex-col gap-5 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-6 pb-[calc(28px+env(safe-area-inset-bottom))] text-left shadow-[0_18px_40px_rgba(16,24,40,.22)] md:max-w-110 md:rounded-[22px] md:p-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start gap-4">
          <span className="bg-brand-25 text-brand-500 grid size-12 shrink-0 place-items-center rounded-full">
            <Star size={22} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <h2
              id={titleId}
              className="text-[20px] large-text:text-[22px] leading-[1.25] font-extrabold"
            >
              Rate the DRRM-H IRS
            </h2>
            <p
              id={bodyId}
              className="text-[15px] large-text:text-[17px] leading-[1.55] text-pretty text-gray-600"
            >
              Your report is in. Tell us how the app worked for you in a short evaluation form. It
              takes about 3 minutes.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={dismiss}
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full border border-gray-200 bg-surface text-gray-700 hover:bg-gray-50',
              FOCUS_RING
            )}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {/* On phone the buttons stack with Rate the app on top. */}
        <div className="flex flex-wrap-reverse gap-3">
          <div className="flex flex-[1_1_140px] flex-col">
            <Button variant="outline" fullWidth data-autofocus onClick={dismiss}>
              Not now
            </Button>
          </div>
          <div className="flex flex-[1_1_140px] flex-col">
            <a
              href={RATE_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={markRated}
              className={cn(
                'bg-brand-solid flex h-13 items-center justify-center gap-2 rounded-full px-6 text-[15px] large-text:text-[17px] font-bold whitespace-nowrap text-white hover:brightness-92',
                FOCUS_RING
              )}
            >
              Rate the app
              <ExternalLink size={16} aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
        <p className="text-[13px] large-text:text-[14px] leading-[1.45] text-pretty text-gray-500">
          Opens Google Forms in a new tab.
          {inAccountMenu && ' You can also find Rate the app in your account menu.'}
        </p>
      </motion.div>
    </div>
  );
}
