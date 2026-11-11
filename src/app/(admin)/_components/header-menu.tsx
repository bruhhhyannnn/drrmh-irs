'use client';

import { Button, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Ellipsis, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

/** One action in a page's ⋯ menu: runs `onSelect`, or opens `href`. */
export type HeaderMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  href?: string;
  /** Delete and the like: red, last, after a separator. */
  danger?: boolean;
};

/** Plain items first, danger ones after; `null` between the two groups draws the separator. */
export function orderMenuItems(items: HeaderMenuItem[]): (HeaderMenuItem | null)[] {
  const plain = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);
  return plain.length && danger.length ? [...plain, null, ...danger] : [...plain, ...danger];
}

const MENU_ITEM = '[role="menuitem"]';

/** Arrow keys, Home and End move between the menu's items, wrapping at the ends. */
function moveFocus(e: React.KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM)];
  if (!items.length) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === 'ArrowDown'
      ? (at + 1) % items.length
      : e.key === 'ArrowUp'
        ? (at - 1 + items.length) % items.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? items.length - 1
            : -1;
  if (next < 0) return;
  e.preventDefault();
  items[next]?.focus();
}

/**
 * The ⋯ (More actions) button at the end of a page header, holding the page's rarely used
 * actions (Edit, Delete, …). `dropdown` opens a menu under the button on tablet and web;
 * `sheet` opens a bottom sheet with Cancel on phone. Esc closes either and focus goes back to ⋯.
 */
export function HeaderMenu({
  items,
  title,
  variant,
}: {
  items: HeaderMenuItem[];
  /** The page title, which heads the phone sheet. */
  title: string;
  variant: 'dropdown' | 'sheet';
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Focus goes back to ⋯ before the action runs, so a dialog it opens returns focus there.
  const select = (item: HeaderMenuItem) => {
    close();
    item.onSelect?.();
  };

  const props = { items: orderMenuItems(items), menuId, onClose: close, onSelect: select };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="More actions"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid size-11 place-items-center rounded-full border-[1.5px] bg-surface text-gray-900 transition-colors duration-120 ease-out hover:border-gray-400 hover:bg-gray-100',
          open ? 'border-gray-400 bg-gray-100' : 'border-gray-300',
          FOCUS_RING
        )}
      >
        <Ellipsis size={20} aria-hidden />
      </button>
      {variant === 'dropdown' ? (
        open && <DropdownMenu {...props} />
      ) : (
        <MotionConfig reducedMotion="user">
          <AnimatePresence>{open && <SheetMenu {...props} title={title} />}</AnimatePresence>
        </MotionConfig>
      )}
    </div>
  );
}

type MenuProps = {
  items: (HeaderMenuItem | null)[];
  menuId: string;
  onClose: () => void;
  onSelect: (item: HeaderMenuItem) => void;
};

function DropdownMenu({ items, menuId, onClose, onSelect }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>(MENU_ITEM)?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      onClose();
    } else {
      moveFocus(e);
    }
  };

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label="More actions"
        onKeyDown={onKeyDown}
        className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-64 max-w-[calc(100vw-32px)] flex-col rounded-2xl border border-gray-200 bg-surface p-1.5 shadow-[0_12px_32px_rgba(16,24,40,.16),0_2px_6px_rgba(16,24,40,.06)]"
      >
        {items.map((item, i) =>
          item ? (
            <MenuItem
              key={item.label}
              item={item}
              onSelect={onSelect}
              className={cn(
                'min-h-11 gap-3 rounded-[10px] px-3 py-2 text-[14px] transition-colors duration-120 ease-out',
                item.danger
                  ? 'hover:bg-error-50 focus:bg-error-50'
                  : 'hover:bg-gray-100 focus:bg-gray-100'
              )}
              iconClassName={item.danger ? 'text-error-700' : 'text-gray-600'}
            />
          ) : (
            <div key={`sep-${i}`} role="separator" className="mx-1 my-1.5 h-px bg-line" />
          )
        )}
      </div>
    </>
  );
}

function SheetMenu({ items, menuId, onClose, onSelect, title }: MenuProps & { title: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(MENU_ITEM)?.focus();
  }, []);

  // Esc closes; Tab stays inside the sheet.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
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
    <div className="fixed inset-0 z-60 flex items-end" onKeyDown={onKeyDown}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgba(16,24,40,.45)]"
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
        className="relative flex max-h-[85dvh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-surface px-4 pt-2.5 pb-[calc(20px+env(safe-area-inset-bottom))] text-left shadow-[0_-18px_40px_rgba(16,24,40,.18)]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <span aria-hidden className="mb-3 h-1 w-10 self-center rounded-full bg-gray-300" />
        <div className="flex flex-col gap-0.5 border-b border-line px-1 pb-3">
          <h2 id={titleId} className="text-[17px] leading-[1.3] font-extrabold text-balance">
            {title}
          </h2>
          <p className="text-[13px] text-gray-500">More actions</p>
        </div>
        <div
          id={menuId}
          role="menu"
          aria-labelledby={titleId}
          onKeyDown={moveFocus}
          className="flex flex-col py-1.5"
        >
          {items.map((item, i) =>
            item ? (
              <MenuItem
                key={item.label}
                item={item}
                onSelect={onSelect}
                className="min-h-14 gap-3.5 rounded-xl px-1.5 py-2 text-[16px]"
                iconClassName={cn(
                  'grid size-10 place-items-center rounded-xl',
                  item.danger ? 'bg-error-50 text-error-700' : 'bg-gray-100 text-gray-700'
                )}
              />
            ) : (
              <div key={`sep-${i}`} role="separator" className="my-1.5 h-px bg-line" />
            )
          )}
        </div>
        <Button variant="outline" fullWidth onClick={onClose}>
          Cancel
        </Button>
      </motion.div>
    </div>
  );
}

function MenuItem({
  item,
  onSelect,
  className,
  iconClassName,
}: {
  item: HeaderMenuItem;
  onSelect: (item: HeaderMenuItem) => void;
  className: string;
  iconClassName: string;
}) {
  const Icon = item.icon;
  const classes = cn(
    'flex w-full items-center text-left font-semibold',
    item.danger ? 'text-error-700' : 'text-gray-900',
    FOCUS_RING,
    className
  );
  const body = (
    <>
      <span className={cn('inline-flex shrink-0', iconClassName)}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{item.label}</span>
    </>
  );
  return item.href ? (
    <Link href={item.href} role="menuitem" className={classes} onClick={() => onSelect(item)}>
      {body}
    </Link>
  ) : (
    <button type="button" role="menuitem" className={classes} onClick={() => onSelect(item)}>
      {body}
    </button>
  );
}
