'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { Card, Skeleton } from './ui';

// One table pattern for every admin list: tabs, a toolbar, a grid table on tablet and web, and a
// card per row on phone. Columns marked `hideOnTablet` only show from 1024px up.

export function ListCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <Card className={cn('flex flex-col', className)}>{children}</Card>;
}

export function ListTabs<K extends string>({
  label,
  tabs,
  value,
  onChange,
  loading = false,
}: {
  label: string;
  tabs: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  /** Placeholder counts while the list loads, instead of zeros. */
  loading?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-[#eaecf0] px-4 md:px-5"
    >
      {tabs.map((tab) => {
        const on = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex h-13 shrink-0 items-center gap-2 border-b-2 px-3 pt-0.5 text-[16px] whitespace-nowrap',
              on
                ? 'border-brand-500 text-brand-500 font-bold'
                : 'border-transparent font-medium text-gray-600 hover:text-gray-900',
              FOCUS_RING,
              'focus-visible:-outline-offset-3'
            )}
          >
            {tab.label}
            {tab.count !== undefined && loading && <Skeleton className="h-5.5 w-6 rounded-full" />}
            {tab.count !== undefined && !loading && (
              <span
                className={cn(
                  'font-landing-mono grid h-5.5 min-w-5.5 place-items-center rounded-full px-1.75 text-[13px] font-semibold',
                  on ? 'bg-brand-25 text-brand-500' : 'bg-gray-100 text-gray-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ListToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-4 md:px-5">
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="flex h-11 max-w-105 min-w-0 flex-[1_1_220px] items-center gap-2.5 rounded-[14px] border border-gray-300 bg-white px-3.5 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]">
      <Search size={18} aria-hidden className="shrink-0 text-gray-500" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-gray-900 outline-none placeholder:text-gray-500"
      />
    </label>
  );
}

/** A list filter ("All events ▾"): a native select, so it works well on phones. */
export function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('relative max-w-full shrink-0', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 w-full max-w-60 appearance-none truncate rounded-[14px] border border-gray-300 bg-white pr-9 pl-3.5 text-[16px] font-medium text-gray-700',
          FOCUS_RING
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500"
      />
    </div>
  );
}

export function ListCount({
  loading = false,
  children,
}: {
  /** A placeholder while the list loads, instead of "0 events". */
  loading?: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <span className="flex flex-[1_0_auto] justify-end">
        <Skeleton className="h-4 w-20 rounded-md" />
      </span>
    );
  }
  return (
    <span className="flex-[1_0_auto] text-right text-[14px] font-medium text-gray-500">
      {children}
    </span>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  /** A grid track, e.g. `minmax(0,1.4fr)` or `72px`. */
  width: string;
  /** The track on tablet, when it differs (e.g. fewer row actions). */
  tabletWidth?: string;
  align?: 'left' | 'right';
  hideOnTablet?: boolean;
  cell: (row: T) => React.ReactNode;
}

/** Inline style that gives a row its tablet and web column tracks. */
export function gridTracks<T>(columns: Column<T>[]) {
  return {
    '--cols-md': columns
      .filter((c) => !c.hideOnTablet)
      .map((c) => c.tabletWidth ?? c.width)
      .join(' '),
    '--cols-lg': columns.map((c) => c.width).join(' '),
  } as React.CSSProperties;
}

export const GRID_ROW =
  'hidden md:grid md:[grid-template-columns:var(--cols-md)] lg:[grid-template-columns:var(--cols-lg)] gap-3 items-center px-5';

export function TableHead<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <div
      role="row"
      style={gridTracks(columns)}
      className={cn(GRID_ROW, 'h-11 border-y border-[#eaecf0] bg-gray-50')}
    >
      {columns.map((c) => (
        <span
          key={c.key}
          role="columnheader"
          className={cn(
            'min-w-0 truncate text-[13px] font-semibold text-gray-600',
            c.align === 'right' && 'text-right',
            c.hideOnTablet && 'md:hidden lg:block'
          )}
        >
          {c.header}
        </span>
      ))}
    </div>
  );
}

export function TableCell<T>({
  column,
  children,
}: {
  column: Column<T>;
  children: React.ReactNode;
}) {
  return (
    <div
      role="cell"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5',
        column.align === 'right' ? 'justify-end' : 'justify-start',
        column.hideOnTablet && 'md:hidden lg:flex'
      )}
    >
      {children}
    </div>
  );
}

const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5'];

/**
 * Placeholder rows in the table's own columns on tablet and web, and placeholder cards on
 * phone, while a list loads: the name column gets two lines, row actions get button squares.
 */
export function TableSkeleton<T>({ columns, rows = 6 }: { columns: Column<T>[]; rows?: number }) {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="hidden md:block">
        <TableHead columns={columns} />
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            style={gridTracks(columns)}
            className={cn(GRID_ROW, 'min-h-16 border-b border-[#eaecf0] py-2.5 last:border-b-0')}
          >
            {columns.map((c, i) => (
              <div
                key={c.key}
                className={cn(
                  'flex min-w-0 items-center gap-1.5',
                  c.align === 'right' ? 'justify-end' : 'justify-start',
                  c.hideOnTablet && 'md:hidden lg:flex'
                )}
              >
                {i === 0 ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton
                      className={cn(
                        'h-4 rounded-md',
                        SKELETON_WIDTHS[row % SKELETON_WIDTHS.length]
                      )}
                    />
                    <Skeleton className="h-3 w-2/5 rounded-md" />
                  </div>
                ) : !c.header ? (
                  <>
                    <Skeleton className="size-8 rounded-[10px]" />
                    <Skeleton className="size-8 rounded-[10px]" />
                  </>
                ) : (
                  <Skeleton
                    className={cn(
                      'h-4 rounded-md',
                      c.align === 'right'
                        ? 'w-10'
                        : SKELETON_WIDTHS[(row + i) % SKELETON_WIDTHS.length]
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <ul aria-hidden className="flex flex-col gap-2.5 px-3 pb-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
          <li
            key={i}
            className="flex flex-col gap-3.5 rounded-[18px] border border-gray-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton
                  className={cn('h-4.5 rounded-md', SKELETON_WIDTHS[i % SKELETON_WIDTHS.length])}
                />
                <Skeleton className="h-3.5 w-1/2 rounded-md" />
              </div>
              <Skeleton className="h-6 w-18 rounded-full" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-3.5 w-24 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Grid table on tablet and web, a card per row on phone. Pass `card` to render the phone
 * card; rows render as table rows only when it is omitted.
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  card,
  loading,
  empty,
  rowClassName,
}: {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  card: (row: T) => React.ReactNode;
  loading?: boolean;
  empty: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (loading && !rows.length) return <TableSkeleton columns={columns} />;
  if (!rows.length) {
    return (
      <div className="border-t border-[#eaecf0] px-5 py-12 text-center text-[16px] text-pretty text-gray-500">
        {empty}
      </div>
    );
  }
  return (
    <>
      <div role="table" aria-label={label} className="hidden md:block">
        <TableHead columns={columns} />
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            role="row"
            style={gridTracks(columns)}
            className={cn(
              GRID_ROW,
              'min-h-16 border-b border-[#eaecf0] py-2.5 last:border-b-0',
              rowClassName?.(row)
            )}
          >
            {columns.map((c) => (
              <TableCell key={c.key} column={c}>
                {c.cell(row)}
              </TableCell>
            ))}
          </div>
        ))}
      </div>
      <ul aria-label={label} className="flex flex-col gap-2.5 px-3 pb-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>{card(row)}</li>
        ))}
      </ul>
    </>
  );
}

/** Name (and a second line) in a table cell, with an optional avatar and amber flag. */
export function NameCell({
  primary,
  secondary,
  avatar,
  flag,
  muted,
  href,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  avatar?: React.ReactNode;
  flag?: string;
  /** Lighter weight for secondary columns such as a date. */
  muted?: boolean;
  href?: string;
}) {
  const title = (
    <span
      className={cn(
        'truncate text-[16px] leading-[1.35]',
        muted ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'
      )}
    >
      {primary}
    </span>
  );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {href ? (
          <Link href={href} className={cn('min-w-0 truncate rounded hover:underline', FOCUS_RING)}>
            {title}
          </Link>
        ) : (
          title
        )}
        {secondary && (
          <span className="truncate text-[14px] leading-[1.35] text-gray-500">{secondary}</span>
        )}
        {flag && (
          <span className="text-[13px] leading-[1.35] font-semibold text-[#b54708]">{flag}</span>
        )}
      </div>
    </div>
  );
}

/** Plain text in a table cell, one line. */
export function TextCell({ children }: { children: React.ReactNode }) {
  return (
    <span className="min-w-0 truncate text-[16px] leading-[1.35] text-gray-700">{children}</span>
  );
}

/** Right-aligned number; grey at zero. */
export function NumberCell({ value, tone }: { value: number; tone?: string }) {
  return (
    <span
      className={cn(
        'font-landing-mono text-[16px] font-semibold',
        value === 0 ? 'text-gray-400' : (tone ?? 'text-gray-900')
      )}
    >
      {value.toLocaleString()}
    </span>
  );
}

/** Icon button with a tooltip. Rows use these instead of bare icons. */
export function IconAction({
  label,
  icon,
  onClick,
  href,
  disabled,
  className: wrapperClassName,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** On the wrapper, e.g. to hide an action on tablet. */
  className?: string;
}) {
  const className = cn(
    'grid size-9 shrink-0 place-items-center rounded-[10px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40',
    FOCUS_RING
  );
  return (
    <span className={cn('group/tip relative inline-flex', wrapperClassName)}>
      {href ? (
        <Link href={href} aria-label={label} className={className}>
          {icon}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={className}
        >
          {icon}
        </button>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 rounded-lg bg-gray-900 px-2 py-1 text-[13px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity group-focus-within/tip:opacity-100 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex">{children}</div>;
}

/** The one next step on a row, e.g. Review or Verify. */
export function RowButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-gray-300 bg-white px-3.5 text-[14px] font-bold whitespace-nowrap text-gray-900 hover:bg-gray-50',
        FOCUS_RING
      )}
    >
      {children}
    </button>
  );
}

const META_TONES = {
  default: 'text-gray-900',
  muted: 'text-gray-400',
  red: 'text-[#b42318]',
  amber: 'text-[#b54708]',
  green: 'text-[#027a48]',
  grey: 'text-gray-600',
};

interface CardAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'outline' | 'primary' | 'danger';
}

/** A list row on phone: title, chip, label / value pairs and labelled buttons. */
export function MobileCard({
  title,
  subtitle,
  avatar,
  chip,
  aside,
  meta = [],
  actions = [],
  handle,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  avatar?: React.ReactNode;
  chip?: React.ReactNode;
  aside?: React.ReactNode;
  meta?: { label: string; value: React.ReactNode; tone?: keyof typeof META_TONES }[];
  actions?: CardAction[];
  handle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[18px] border border-gray-200 bg-white p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {handle}
        {avatar}
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="text-[17px] leading-[1.35] font-bold text-pretty">{title}</span>
          {subtitle && (
            <span className="text-[14px] leading-[1.4] [overflow-wrap:anywhere] text-gray-500">
              {subtitle}
            </span>
          )}
        </div>
        {chip}
        {aside && (
          <span className="font-landing-mono shrink-0 text-[13px] leading-[1.6] font-medium text-gray-500">
            {aside}
          </span>
        )}
      </div>
      {meta.length > 0 && (
        <dl className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-[14px] leading-[1.4]">
          {meta.map((m, i) => (
            <div key={`${m.label}-${i}`} className="flex gap-1.5">
              <dt className="text-gray-500">{m.label}</dt>
              <dd className={cn('font-semibold', META_TONES[m.tone ?? 'default'])}>{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions.length > 0 && (
        <div className="flex gap-2 border-t border-[#eaecf0] pt-3">
          {actions.map((a) => {
            const className = cn(
              'flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[16px] font-bold whitespace-nowrap',
              a.variant === 'primary' && 'border-brand-500 bg-brand-500 text-white',
              a.variant === 'danger' && 'border-[#fda29b] bg-white text-[#b42318]',
              (!a.variant || a.variant === 'outline') && 'border-gray-300 bg-white text-gray-700',
              FOCUS_RING
            );
            return a.href ? (
              <Link key={a.label} href={a.href} className={className}>
                {a.icon}
                {a.label}
              </Link>
            ) : (
              <button key={a.label} type="button" onClick={a.onClick} className={className}>
                {a.icon}
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const button = (disabled: boolean) =>
    cn(
      'grid size-10 place-items-center rounded-full border bg-white',
      disabled ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-700 hover:bg-gray-50',
      FOCUS_RING
    );
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#eaecf0] px-4 py-3 md:px-5">
      <span className="text-[14px] font-medium text-gray-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className={button(page <= 1)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className={button(page >= totalPages)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
