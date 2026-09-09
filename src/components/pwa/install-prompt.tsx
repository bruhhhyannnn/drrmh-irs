'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
 * Prompts the user to install the app as a PWA. On Android/desktop Chrome this uses the
 * native `beforeinstallprompt` flow; iOS Safari never fires that event, so it falls back to
 * a one-time "Add to Home Screen" hint instead. Installing matters here beyond convenience —
 * it's the prerequisite for the offline report queue (see `useOfflineReportQueue`), since a
 * plain browser tab won't reliably keep a service worker + queued data around between visits.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-gray-900"
        >
          <div className="bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Download size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Install IRS</p>
            {deferredEvent ? (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Install the app for faster access and offline report submission.
              </p>
            ) : (
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                Tap <Share size={12} className="inline shrink-0" /> then &quot;Add to Home
                Screen&quot; for offline access.
              </p>
            )}

            {deferredEvent && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstall}
                  className="bg-brand-500 hover:bg-brand-600 rounded-lg px-3.5 py-1.5 text-xs font-medium text-white transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
                >
                  Not now
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
