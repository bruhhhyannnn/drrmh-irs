'use client';

import { FOCUS_RING } from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { cn } from '@/lib';
import { useCampusScopeStore } from '@/store';
import { Check, ChevronDown, University } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/** The campus every admin page shows; '' while All campuses is picked. */
export function useScopedCampusId() {
  const campusId = useCampusScopeStore((s) => s.campusId);
  const { data: campuses } = useCampuses();
  // A remembered campus that was deleted since falls back to All campuses.
  if (campusId && campuses && !campuses.some((c) => c.id === campusId)) return '';
  return campusId;
}

/**
 * One campus switcher in the top bar instead of an All campuses filter on every list. The
 * choice is remembered on this device.
 */
export function CampusSwitcher() {
  const campusId = useScopedCampusId();
  const setCampusId = useCampusScopeStore((s) => s.setCampusId);
  const { data: campuses = [] } = useCampuses();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const active = campuses.filter((c) => c.is_active || c.id === campusId);
  const current = campuses.find((c) => c.id === campusId);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const pick = (id: string) => {
    setCampusId(id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const options = [{ id: '', name: 'All campuses' }, ...active];

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 max-w-full min-w-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-[14px] font-semibold whitespace-nowrap text-gray-900 hover:bg-gray-50',
          FOCUS_RING
        )}
      >
        <University size={16} aria-hidden className="text-brand-500 shrink-0" />
        <span className="sr-only">Campus: </span>
        <span className="min-w-0 truncate">{current?.name ?? 'All campuses'}</span>
        <ChevronDown size={16} aria-hidden className="shrink-0 text-gray-500" />
      </button>

      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Show campus"
            className="absolute top-[calc(100%+6px)] left-0 z-50 flex max-h-[min(420px,70dvh)] w-70 max-w-[calc(100vw-32px)] flex-col overflow-y-auto rounded-[18px] border border-gray-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(16,24,40,.22)]"
          >
            {options.map((option) => {
              const on = option.id === campusId;
              return (
                <button
                  key={option.id || 'all'}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => pick(option.id)}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[14px]',
                    on
                      ? 'bg-brand-25 text-brand-500 font-bold'
                      : 'font-medium text-gray-900 hover:bg-gray-50',
                    FOCUS_RING
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {on && <Check size={16} aria-hidden className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
