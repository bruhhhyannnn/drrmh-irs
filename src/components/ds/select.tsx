'use client';

import { cn } from '@/lib';
import { Check, ChevronDown } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FOCUS_RING } from './focus';
import { figtree, splineSansMono } from './fonts';

// The one select in the app, in place of the browser's: the field shows the choice and a
// chevron, and the list opens in a card under it (above it when there's no room) with the
// current choice ticked. Keyboard: arrows, Home / End, Enter, Escape and type-to-jump. Focus
// stays on the field while the list is open (aria-activedescendant), so drawers keep their
// focus trap. The list is portalled to <body> so a drawer or card can't clip it.

export interface SelectOption {
  value: string;
  label: string;
  /** A rule above this option, e.g. before "Other (please specify)". */
  separator?: boolean;
}

/** The value of "Other (please specify)", which opens a text field for a name not listed. */
export const OTHER_VALUE = '__other__';

/** Last in a unit or position list. */
export const OTHER_OPTION: SelectOption = {
  value: OTHER_VALUE,
  label: 'Other (please specify)',
  separator: true,
};

const VARIANTS = {
  /** The 48px form field, the same as the text inputs. */
  field: 'h-12 rounded-2xl pr-3.5 text-[15px] large-text:text-[17px]',
  /** A list filter in a toolbar ("All events ▾"). */
  filter: 'h-11 rounded-[14px] pr-3 text-[16px] font-medium text-gray-700',
};

const GAP = 6;
const EDGE = 12;
const MAX_HEIGHT = 320;

type ListPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/** Under the field, or above it when there's more room there; never past the viewport. */
function placeList(trigger: HTMLElement, minWidth: number): ListPosition {
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const below = window.innerHeight - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const width = Math.min(Math.max(rect.width, minWidth), viewportWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(rect.left, viewportWidth - width - EDGE));
  if (below < Math.min(MAX_HEIGHT, 200) && above > below) {
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left,
      width,
      maxHeight: Math.min(MAX_HEIGHT, above),
    };
  }
  return { top: rect.bottom + GAP, left, width, maxHeight: Math.min(MAX_HEIGHT, below) };
}

/** Closes the list that is open, so opening another select never leaves two on screen. */
let closeOpenList: (() => void) | null = null;

const isTypeChar = (e: React.KeyboardEvent) =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  label,
  required,
  disabled,
  invalid,
  leading,
  describedBy,
  variant = 'field',
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown in grey while nothing (or the empty option) is picked. Without one, the empty
   * option shows by its label, e.g. a filter's "All types". */
  placeholder?: string;
  /** The accessible name, for a select without a `<label for>`. */
  label?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Sits inside the field on the left, e.g. the campus logo. */
  leading?: React.ReactNode;
  describedBy?: string;
  variant?: keyof typeof VARIANTS;
  /** Extra classes for the field, e.g. a narrower height. */
  className?: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<ListPosition | null>(null);
  // The list lives outside the page root, so it copies the large type scale and a forced
  // light theme (the A4 report) from where the field sits.
  const [frame, setFrame] = useState<{ large: boolean; theme?: string }>({ large: false });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const minWidth = variant === 'filter' ? 220 : 0;
  const last = options.length - 1;

  const openList = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;
    setPosition(placeList(trigger, minWidth));
    setFrame({
      large: !!trigger.closest('[data-large-text]'),
      theme: trigger.closest('[data-theme]')?.getAttribute('data-theme') ?? undefined,
    });
    setActive(Math.max(0, Math.min(index, last)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    closeOpenList?.();
    const close = () => setOpen(false);
    closeOpenList = close;
    return () => {
      if (closeOpenList === close) closeOpenList = null;
    };
  }, [open]);

  const pick = (index: number) => {
    const option = options[index];
    setOpen(false);
    if (option && option.value !== value) onChange(option.value);
  };

  /** Type-to-jump: letters typed within half a second build one search; one letter cycles. */
  const jumpTo = (char: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 500 ? char : t.text + char;
    t.at = now;
    const query = t.text.toLowerCase();
    const repeated = [...query].every((c) => c === query[0]);
    const needle = repeated ? query[0] : query;
    const start = open ? active : selectedIndex;
    const from = repeated ? start + 1 : Math.max(start, 0);
    for (let k = 0; k < options.length; k++) {
      const i = (from + k + options.length) % options.length;
      if (options[i].label.toLowerCase().startsWith(needle)) {
        if (open) setActive(i);
        else openList(i);
        return;
      }
    }
    if (!open) openList();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        openList(e.key === 'Home' ? 0 : last);
      } else if (isTypeChar(e)) {
        e.preventDefault();
        jumpTo(e.key);
      }
      return;
    }
    const move = (to: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(to, last)));
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(active + 1);
      case 'ArrowUp':
        return move(active - 1);
      case 'PageDown':
        return move(active + 10);
      case 'PageUp':
        return move(active - 10);
      case 'Home':
        return move(0);
      case 'End':
        return move(last);
      case 'Enter':
        e.preventDefault();
        return pick(active);
      case ' ':
        e.preventDefault();
        // A space inside a quick search ("Room 3…") is part of it.
        if (Date.now() - typed.current.at < 500) return jumpTo(' ');
        return pick(active);
      case 'Escape':
        // Only the list closes, not the drawer or dialog around the field.
        e.preventDefault();
        e.stopPropagation();
        return setOpen(false);
      case 'Tab':
        return setOpen(false);
      default:
        if (isTypeChar(e)) {
          e.preventDefault();
          jumpTo(e.key);
        }
    }
  };

  useEffect(() => {
    if (!open) return;
    const reposition = (e?: Event) => {
      if (e && listRef.current?.contains(e.target as Node)) return;
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // Scrolled out of view: close rather than float over something else.
      if (rect.bottom < 0 || rect.top > window.innerHeight) return setOpen(false);
      setPosition(placeList(trigger, minWidth));
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, minWidth]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const showPlaceholder = placeholder !== undefined && !selected?.value;
  const text = showPlaceholder ? placeholder : (selected?.label ?? '');

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        // Firefox clicks a button on Space's keyup; the list already handled the key.
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        onBlur={(e) => {
          if (!listRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
        className={cn(
          'relative flex w-full min-w-0 items-center gap-2.5 border bg-surface text-left text-gray-900 transition-[border-color,box-shadow] duration-120',
          VARIANTS[variant],
          leading ? 'pl-12' : variant === 'field' ? 'pl-4' : 'pl-3.5',
          open
            ? 'border-brand-500 shadow-[0_0_0_4px_rgba(161,29,29,.12)]'
            : invalid
              ? 'border-error-700'
              : 'border-gray-300',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
          FOCUS_RING,
          className
        )}
      >
        {leading && (
          <span className="pointer-events-none absolute top-1/2 left-2.5 flex -translate-y-1/2">
            {leading}
          </span>
        )}
        {/* A filter is as wide as its longest option, as a browser select is, so it doesn't
            change width with the choice. */}
        <span className="grid min-w-0 flex-1">
          <span
            className={cn(
              'col-start-1 row-start-1 truncate',
              showPlaceholder && !disabled && 'text-gray-500'
            )}
          >
            {text}
          </span>
          {variant === 'filter' &&
            options.map((o) => (
              <span
                key={o.value}
                aria-hidden
                className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap"
              >
                {o.label}
              </span>
            ))}
        </span>
        <ChevronDown
          size={variant === 'field' ? 18 : 16}
          aria-hidden
          className={cn(
            'shrink-0 transition-transform duration-160 ease-[cubic-bezier(.2,.7,.3,1)]',
            disabled ? 'text-gray-400' : 'text-gray-500',
            open && 'rotate-180'
          )}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label ?? placeholder}
            data-theme={frame.theme}
            data-large-text={frame.large || undefined}
            // Keeps focus (and the open list) on the field while an option is clicked.
            onMouseDown={(e) => e.preventDefault()}
            style={position}
            className={cn(
              figtree.variable,
              splineSansMono.variable,
              'font-landing fixed z-70 flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-surface p-1.5 text-gray-900 antialiased shadow-[0_12px_24px_-4px_rgba(16,24,40,.14),0_4px_8px_-2px_rgba(16,24,40,.06)]'
            )}
          >
            {options.length === 0 && (
              <p className="px-3 py-3 text-[14px] large-text:text-[16px] text-gray-500">
                Nothing to choose yet.
              </p>
            )}
            {options.map((option, i) => {
              const on = i === selectedIndex;
              const hot = i === active;
              return (
                <Fragment key={option.value}>
                  {option.separator && i > 0 && (
                    <div aria-hidden className="mx-1.5 my-1 h-px shrink-0 bg-line" />
                  )}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    onMouseMove={() => hot || setActive(i)}
                    onClick={() => pick(i)}
                    className={cn(
                      'flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[15px] large-text:text-[17px] leading-[1.35]',
                      on ? 'bg-brand-25 text-brand-500 font-semibold' : 'text-gray-900',
                      hot && (on ? 'bg-brand-50' : 'bg-gray-100')
                    )}
                  >
                    <span className="min-w-0 flex-1 py-2">{option.label}</span>
                    {on && <Check size={18} aria-hidden className="text-brand-500 shrink-0" />}
                  </div>
                </Fragment>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
