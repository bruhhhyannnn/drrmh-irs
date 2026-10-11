'use client';

import { Button, FieldError, FieldHelp, FieldLabel } from '@/components/ds';
import { cn } from '@/lib';

// Pieces of the admin drawer: grouped sections, a two-column form grid, label / value lists and
// the footer buttons. The drawer itself is the shared one in components/ds.

/** Drawer body: sections 28px apart. */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-7">{children}</div>;
}

/** A group in the drawer with a small uppercase title and an optional note on the right. */
export function DrawerSection({
  title,
  aside,
  children,
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      {title && (
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
            {title}
          </h3>
          {aside && <span className="text-[13px] font-semibold text-gray-600">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Two columns on tablet and web, one on phone. */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

/** Label row (with Required / Optional), the control, then an error or a hint. */
export function FormField({
  id,
  label,
  hint,
  error,
  help,
  half,
  labelAs = 'label',
  children,
}: {
  id: string;
  label: string;
  hint?: 'Required' | 'Optional' | string;
  error?: string;
  help?: React.ReactNode;
  /** One column of the grid on tablet and web; the full row otherwise. */
  half?: boolean;
  /** `span` for controls that aren't a single input (segmented controls, checklists). */
  labelAs?: 'label' | 'span';
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', !half && 'md:col-span-2')}>
      <FieldLabel id={`${id}-label`} htmlFor={labelAs === 'label' ? id : undefined} hint={hint}>
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        help && <FieldHelp id={`${id}-help`}>{help}</FieldHelp>
      )}
    </div>
  );
}

/** Label / value rows in a bordered box. */
export function KvList({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col rounded-2xl border border-[#eaecf0] bg-white px-4 py-0.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-[#eaecf0] py-3 text-[14px] leading-[1.45] last:border-b-0"
        >
          <dt className="flex-[0_0_130px] text-gray-500">{row.label}</dt>
          <dd className="min-w-0 flex-[1_1_160px] font-semibold text-gray-900">
            {row.value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Cancel / primary (and sometimes a red button) side by side, wrapping on narrow screens. */
export function DrawerButtons({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap-reverse gap-3">{children}</div>;
}

export function DrawerButton({
  variant = 'primary',
  type = 'button',
  form,
  onClick,
  loading,
  disabled,
  children,
}: {
  variant?: 'primary' | 'outline' | 'danger';
  type?: 'button' | 'submit';
  form?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-[1_1_140px] flex-col">
      <Button
        variant={variant}
        type={type}
        form={form}
        fullWidth
        loading={loading}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </div>
  );
}

/** Avatar, name and one line, at the top of a drawer. */
export function PersonHeader({
  avatar,
  name,
  detail,
}: {
  avatar: React.ReactNode;
  name: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3.5">
      {avatar}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[17px] leading-[1.3] font-bold">{name}</span>
        {detail && <span className="truncate text-[13px] text-gray-500">{detail}</span>}
      </div>
    </div>
  );
}

/** Grey boxes with a label and a big number, two to a row. */
export function StatBoxes({
  stats,
}: {
  stats: { label: string; value: number; tone?: 'red' | 'amber' }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col gap-1 rounded-2xl border border-[#eaecf0] bg-gray-50 px-4 py-3.5"
        >
          <span className="text-[12px] font-semibold text-gray-500">{s.label}</span>
          <span
            className={cn(
              'font-landing-mono text-[26px] leading-[1.1] font-extrabold',
              s.value === 0
                ? 'text-gray-400'
                : s.tone === 'red'
                  ? 'text-[#b42318]'
                  : s.tone === 'amber'
                    ? 'text-[#b54708]'
                    : 'text-gray-900'
            )}
          >
            {s.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
