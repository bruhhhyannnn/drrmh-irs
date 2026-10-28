'use client';

import { cn } from '@/lib';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { forwardRef, useState } from 'react';
import { Spinner } from '../ui/spinner';
import { FOCUS_RING } from './focus';
import { Select, type SelectOption } from './select';

// Form controls from the design system: 48px fields with a 16px radius, 52px pill buttons,
// neutral grey "Required" marks and red only for errors.

/**
 * Label row: the field name on the left, then either a grey Required / Optional `hint` or an
 * `action` such as a "Forgot password?" link on the right.
 */
export function FieldLabel({
  id,
  htmlFor,
  hint,
  action,
  children,
}: {
  id?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label
        id={id}
        htmlFor={htmlFor}
        className="text-[14px] large-text:text-[16px] font-semibold text-gray-700"
      >
        {children}
      </Label>
      {hint && (
        <span className="text-[12px] large-text:text-[13px] font-medium text-gray-500">{hint}</span>
      )}
      {action}
    </div>
  );
}

export function FieldHelp({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className="text-[13px] large-text:text-[14px] leading-[1.45] text-pretty text-gray-500"
    >
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className="text-[13px] large-text:text-[14px] leading-[1.45] font-semibold text-error-700"
    >
      {children}
    </p>
  );
}

const CONTROL =
  'w-full rounded-2xl border bg-surface text-[15px] large-text:text-[17px] text-gray-900 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';

const controlBorder = (invalid?: boolean) => (invalid ? 'border-error-700' : 'border-gray-300');

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function TextInput({ invalid, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-12 px-4', controlBorder(invalid), FOCUS_RING, className)}
      {...props}
    />
  );
});

/** Password field with a Show / Hide text button inside it. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-20', className)}
        {...props}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          'absolute top-1/2 right-2.5 h-8 -translate-y-1/2 rounded-lg px-1.5 text-[14px] large-text:text-[16px] font-bold text-gray-600 hover:text-gray-900',
          FOCUS_RING
        )}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function TextArea({ invalid, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        'h-28 resize-none px-4 py-3.5 leading-[1.45]',
        controlBorder(invalid),
        FOCUS_RING,
        className
      )}
      {...props}
    />
  );
});

/**
 * A form select (the design system's `Select`) for a `<label for>`. `leading` sits inside the
 * field on the left, e.g. the campus logo. An optional field's list starts with an empty
 * choice, `emptyLabel` (the placeholder by default, e.g. "No unit"), so a choice can be cleared.
 */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  required,
  disabled,
  invalid,
  leading,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  leading?: React.ReactNode;
  describedBy?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={required ? options : [{ value: '', label: emptyLabel ?? placeholder }, ...options]}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      invalid={invalid}
      leading={leading}
      describedBy={describedBy}
    />
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand-solid text-white hover:brightness-92',
  outline: 'border-[1.5px] border-gray-300 bg-surface text-gray-900 hover:brightness-97',
  ghost: 'text-gray-700 hover:bg-gray-100',
  /** Delete next to other actions: red outline. */
  danger: 'border-[1.5px] border-error-300 bg-surface text-error-700 hover:bg-error-50',
  /** The confirm button of a delete dialog. */
  destructive: 'bg-error-600 text-white hover:brightness-92',
};

type ButtonStyle = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
};

function buttonClass({ variant = 'primary', size = 'md', fullWidth }: ButtonStyle) {
  return cn(
    'items-center justify-center gap-2 rounded-full leading-none font-bold whitespace-nowrap transition-[filter,scale,background-color] duration-120 ease-[cubic-bezier(.2,.7,.3,1)] active:scale-98',
    size === 'md'
      ? 'h-13 px-6 text-[15px] large-text:text-[17px]'
      : 'h-10 px-4.5 text-[14px] large-text:text-[16px]',
    fullWidth ? 'flex w-full' : 'inline-flex',
    BUTTON_VARIANTS[variant],
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:brightness-100 disabled:active:scale-100',
    FOCUS_RING
  );
}

/** The design system's pill button: 52px (md) or 40px (sm). */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  className,
  children,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyle & {
    loading?: boolean;
  }) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={cn(
        buttonClass({ variant, size, fullWidth }),
        loading && 'pointer-events-none',
        className
      )}
      {...props}
    >
      {loading && <Spinner label={null} />}
      {children}
    </button>
  );
}

/** The pill button as an in-app link. */
export function ButtonLink({
  href,
  variant,
  size,
  fullWidth,
  className,
  children,
}: ButtonStyle & { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(buttonClass({ variant, size, fullWidth }), className)}>
      {children}
    </Link>
  );
}

/**
 * One choice in a tile grid (incident type, casualty condition). A real radio input underneath
 * keeps arrow-key navigation and screen reader semantics.
 */
export function OptionTile({
  name,
  value,
  checked,
  onSelect,
  className,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-2 text-center leading-tight transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]',
        checked
          ? 'border-brand-500 bg-brand-25 text-brand-500 border-2 font-bold'
          : 'border-[1.5px] border-gray-200 bg-surface font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50',
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {checked && <Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />}
      <span className="text-balance">{children}</span>
    </label>
  );
}

/** Pill segmented control (e.g. Male / Female / Unknown), built on radio inputs. */
export function SegmentedControl({
  name,
  labelledBy,
  options,
  value,
  onChange,
}: {
  name: string;
  labelledBy: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex gap-1 rounded-full bg-gray-100 p-1"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-[14px] large-text:text-[16px] transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]',
              on
                ? 'bg-surface font-bold text-gray-900 shadow-[0_1px_3px_rgba(16,24,40,.12)] dark:bg-gray-300'
                : 'font-semibold text-gray-600'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={on}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

/** − count + pill. The count is also typeable, for large numbers. */
export function Stepper({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const set = (next: number) => onChange(Math.max(0, Math.min(100_000, next)));
  return (
    <div className="flex h-12.5 shrink-0 items-center overflow-hidden rounded-full border border-gray-300 bg-surface">
      <button
        type="button"
        aria-label={`${label}: minus one`}
        disabled={value === 0}
        onClick={() => set(value - 1)}
        className={cn(
          'size-12 text-[20px] large-text:text-[22px] leading-none font-semibold text-gray-600 max-[359px]:size-11 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`${label} count`}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 0)}
        className={cn(
          'font-landing-mono h-full w-14 bg-transparent text-center max-[359px]:w-10 text-[15px] large-text:text-[17px] font-semibold text-gray-900',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      />
      <button
        type="button"
        aria-label={`${label}: plus one`}
        onClick={() => set(value + 1)}
        className={cn(
          'text-brand-500 hover:bg-brand-25 size-12 text-[20px] large-text:text-[22px] leading-none font-semibold max-[359px]:size-11',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      >
        +
      </button>
    </div>
  );
}
