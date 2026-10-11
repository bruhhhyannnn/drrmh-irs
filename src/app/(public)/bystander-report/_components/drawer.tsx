'use client';

import { FOCUS_RING } from '@/app/(public)/_components/primitives';
import { cn } from '@/lib';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useSyncExternalStore } from 'react';

const TABLET_UP = '(min-width: 768px)';

function useIsTabletUp() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(TABLET_UP);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(TABLET_UP).matches,
    () => true
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Opens over the current step so nothing typed is lost: a side drawer on tablet and web, a
 * bottom sheet on phones. Children mount fresh on every open, so a drawer's own state starts
 * from its props each time.
 */
export function Drawer({ open, ...props }: DrawerProps) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open && <DrawerPanel {...props} />}</AnimatePresence>
    </MotionConfig>
  );
}

function DrawerPanel({ onClose, title, subtitle, footer, children }: Omit<DrawerProps, 'open'>) {
  const isTabletUp = useIsTabletUp();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus moves into the drawer on open and back to whatever opened it on close; the page
  // behind doesn't scroll.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    // Keep Tab inside the drawer.
    const focusables = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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

  const offscreen = isTabletUp ? { x: '100%' } : { y: '100%' };

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgba(16,24,40,.55)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 top-14 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_18px_40px_rgba(16,24,40,.22)] md:top-0 md:left-auto md:w-120 md:rounded-none lg:w-130"
        initial={offscreen}
        animate={{ x: 0, y: 0 }}
        exit={offscreen}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex shrink-0 items-start gap-4 border-b border-[#eaecf0] p-5 md:px-7 md:py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-[20px] leading-tight font-extrabold">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] leading-[1.45] text-pretty text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            data-autofocus
            aria-label="Close"
            onClick={onClose}
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50',
              FOCUS_RING
            )}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5 md:gap-6 md:px-7 md:py-6">
          {children}
        </div>
        <div className="shrink-0 border-t border-[#eaecf0] px-5 py-4 md:px-7">{footer}</div>
      </motion.div>
    </div>
  );
}
