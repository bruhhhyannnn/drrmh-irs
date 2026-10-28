'use client';

import { Button, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { AlertTriangle, Check } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Round icon at the top; red for delete, green for complete. */
  icon: React.ReactNode;
  tone: 'danger' | 'success' | 'neutral';
  title: string;
  /** The item, in bold, followed by `body`: "Q1 2026 NSED — UP Manila will be…". */
  name?: string;
  body: React.ReactNode;
  /** Amber box: what is linked, or what happens next. */
  warning?: React.ReactNode;
  /** Red box after the action failed: what went wrong, in plain words. */
  error?: { title: string; body: React.ReactNode };
  /** An optional extra choice under the warning, e.g. "Also complete it at …". */
  checkbox?: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  };
  confirmLabel: string;
  confirmVariant?: 'destructive' | 'primary';
  /** Off when trying again can't help (the error explains why). */
  confirmDisabled?: boolean;
  loading?: boolean;
}

/**
 * Asks before something that can't be undone. Names the item and what is linked to it, and the
 * confirm button is the only red (or maroon) one.
 */
export function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open && <DialogPanel {...props} />}</AnimatePresence>
    </MotionConfig>
  );
}

const ICON_TONES = {
  danger: 'bg-error-50 text-error-600',
  success: 'bg-success-50 text-success-700',
  neutral: 'bg-gray-100 text-gray-600',
};

function DialogPanel({
  onClose,
  onConfirm,
  icon,
  tone,
  title,
  name,
  body,
  warning,
  error,
  checkbox,
  confirmLabel,
  confirmVariant = 'destructive',
  confirmDisabled,
  loading,
}: Omit<ConfirmDialogProps, 'open'>) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!loading) onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = [
      ...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
    ];
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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgba(16,24,40,.55)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => !loading && onClose()}
      />
      <motion.div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative flex max-h-full w-full max-w-110 flex-col gap-5 overflow-y-auto rounded-[22px] bg-surface p-6 shadow-[0_18px_40px_rgba(16,24,40,.22)]"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={cn('grid size-12 place-items-center rounded-full', ICON_TONES[tone])}>
          {icon}
        </span>
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-[20px] leading-tight font-extrabold">
            {title}
          </h2>
          <p id={bodyId} className="text-[15px] leading-[1.55] text-pretty text-gray-600">
            {name && <strong className="font-bold text-gray-900">{name}</strong>} {body}
          </p>
        </div>
        {warning && (
          <div className="bg-warning-50 flex items-start gap-2.5 rounded-2xl border border-warning-200 px-3.5 py-3 text-[14px] leading-normal font-medium text-warning-800">
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0 text-warning-700" />
            <span className="text-pretty">{warning}</span>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="bg-error-50 flex items-start gap-2.5 rounded-2xl border border-error-200 px-3.5 py-3 text-[14px] leading-normal"
          >
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0 text-error-600" />
            <span className="flex min-w-0 flex-col gap-0.5 text-pretty">
              <strong className="font-bold text-error-700">{error.title}</strong>
              <span className="text-error-800">{error.body}</span>
            </span>
          </div>
        )}
        {checkbox && (
          <button
            type="button"
            role="checkbox"
            aria-checked={checkbox.checked}
            onClick={() => checkbox.onChange(!checkbox.checked)}
            className={cn(
              'flex items-start gap-3 rounded-2xl border border-gray-300 bg-surface px-3.5 py-3 text-left hover:bg-gray-50',
              FOCUS_RING
            )}
          >
            <CheckBox checked={checkbox.checked} className="mt-px" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] leading-[1.4] font-semibold">{checkbox.label}</span>
              {checkbox.description && (
                <span className="text-[13px] leading-[1.45] text-gray-500">
                  {checkbox.description}
                </span>
              )}
            </span>
          </button>
        )}
        <div className="flex flex-wrap-reverse gap-3">
          <div className="flex flex-[1_1_140px] flex-col">
            <Button variant="outline" fullWidth data-autofocus onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
          <div className="flex flex-[1_1_140px] flex-col">
            <Button
              variant={confirmVariant}
              fullWidth
              loading={loading}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** 20px checkbox square: maroon with a tick when checked, a dash when `partial`. */
export function CheckBox({
  checked,
  partial,
  className,
}: {
  checked: boolean;
  partial?: boolean;
  className?: string;
}) {
  const on = checked || partial;
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] text-white',
        on ? 'border-brand-solid bg-brand-solid' : 'border-gray-300 bg-surface',
        className
      )}
    >
      {checked ? (
        <Check size={12} strokeWidth={3} />
      ) : partial ? (
        <span className="h-0.5 w-2 rounded bg-surface" />
      ) : null}
    </span>
  );
}
