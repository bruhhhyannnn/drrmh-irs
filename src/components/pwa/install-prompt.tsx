'use client';

// Direct paths: this mounts on every page, and the ds index also pulls in the map.
import { Button } from '@/components/ds/fields';
import { FOCUS_RING } from '@/components/ds/focus';
import { figtree } from '@/components/ds/fonts';
import { cn } from '@/lib';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId, useState } from 'react';

const DISMISS_KEY = 'irs-install-prompt-dismissed-at';
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage unavailable — nothing to persist, prompt just reappears next visit
  }
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's non-standard flag for an installed home-screen app
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Height of a bar fixed or stuck to the bottom edge (the admin bottom tabs, the ERT submit bar),
 * marked with `data-bottom-bar`, so the card can sit above it instead of covering it.
 */
function useBottomBarHeight(active: boolean) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let tallest = 0;
        for (const bar of document.querySelectorAll<HTMLElement>('[data-bottom-bar]')) {
          const rect = bar.getBoundingClientRect();
          if (rect.height > 0 && rect.bottom >= window.innerHeight - 1) {
            tallest = Math.max(tallest, window.innerHeight - rect.top);
          }
        }
        setHeight(tallest);
      });
    };
    measure();
    // Bars come and go with the page (a form that finishes loading, a route change).
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [active]);

  return height;
}

/**
 * Prompts the user to install the app as a PWA. On Android/desktop Chrome this uses the
 * native `beforeinstallprompt` flow; iOS Safari never fires that event, so it falls back to
 * the two "Add to Home Screen" steps instead. Installing matters here beyond convenience —
 * it's the prerequisite for the offline report queue, since a plain browser tab won't reliably
 * keep a service worker + queued data around between visits.
 *
 * A card in the design system's style, bottom-right from tablet up and full width on phone,
 * above any bottom bar and under drawers and dialogs.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reduceMotion = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleInstalled = () => {
      setDeferredEvent(null);
      markDismissed();
    };
    window.addEventListener('appinstalled', handleInstalled);

    if (isIos()) setShowIosHint(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    markDismissed();
  };

  const handleInstall = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    if (outcome !== 'accepted') markDismissed();
  };

  const visible = !dismissed && (deferredEvent !== null || showIosHint);
  const barHeight = useBottomBarHeight(visible);
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          aria-labelledby={titleId}
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
          transition={{ duration: 0.25, ease: [0.2, 0.7, 0.3, 1] }}
          style={{
            bottom: barHeight ? barHeight + 12 : 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
          className={cn(
            figtree.variable,
            'font-landing fixed inset-x-4 z-35 mx-auto flex max-w-105 flex-col gap-4 rounded-[22px] border border-gray-200 bg-white p-4 text-gray-900 shadow-[0_18px_40px_rgba(16,24,40,.22)] antialiased md:right-6 md:left-auto md:w-105 md:p-5 print:hidden'
          )}
        >
          <div className="flex items-start gap-3.5">
            {/* The precached PWA icon, so the card looks right offline too. */}
            <Image
              src="/icon-192x192.png"
              alt=""
              width={52}
              height={52}
              unoptimized
              loading="eager"
              className="size-13 shrink-0 rounded-[14px] border border-[#eaecf0] bg-white object-contain p-1"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <h2 id={titleId} className="text-[17px] leading-tight font-extrabold">
                Install the IRS app
              </h2>
              <p className="text-[14px] leading-[1.45] text-pretty text-gray-600">
                Open it from your home screen, and send reports even when you have no signal.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close"
              className={cn(
                '-mt-1.5 -mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                FOCUS_RING
              )}
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          {deferredEvent ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleInstall} className="flex-1">
                <Download size={16} aria-hidden />
                Install
              </Button>
              <Button size="sm" variant="outline" onClick={handleDismiss} className="flex-1">
                Not now
              </Button>
            </div>
          ) : (
            <>
              <ol className="flex flex-col gap-2.5 rounded-2xl bg-gray-50 px-3.5 py-3 text-[14px] leading-[1.4] text-gray-700">
                <IosStep n={1}>
                  Tap <Share size={16} aria-hidden className="text-brand-500 shrink-0" />
                  <b className="font-semibold text-gray-900">Share</b> in Safari
                </IosStep>
                <IosStep n={2}>
                  Choose <SquarePlus size={16} aria-hidden className="text-brand-500 shrink-0" />
                  <b className="font-semibold text-gray-900">Add to Home Screen</b>
                </IosStep>
              </ol>
              <Button size="sm" variant="outline" fullWidth onClick={handleDismiss}>
                Got it
              </Button>
            </>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function IosStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="bg-brand-25 text-brand-500 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold">
        {n}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">{children}</span>
    </li>
  );
}
