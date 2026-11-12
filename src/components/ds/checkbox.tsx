'use client';

import { cn } from '@/lib';
import { Check } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useId, useRef } from 'react';
import { FieldError } from './fields';

/**
 * The form checkbox: a real `<input type="checkbox">`, visually hidden, so `form.register()`,
 * `required` and validation keep working, with the 20px square drawn from its state. The whole
 * row toggles and is at least 44px tall on touch screens.
 *
 * States: default (gray-300 border), hover (gray-400 border, hover fill), checked (maroon, white
 * tick), partly checked (`partial`: a dash, `aria-checked="mixed"`), keyboard focus (2px ring,
 * 2px offset), disabled (gray-100 fill; gray-300 when checked) and error (`error`: red border,
 * the message under the row, linked with `aria-describedby`).
 */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
    label: React.ReactNode;
    /** A second line under the label. */
    description?: React.ReactNode;
    /** Some of a group is checked: a dash instead of the tick. */
    partial?: boolean;
    /** The error message; marks the box invalid and shows the message under it. */
    error?: string;
    /** `sm`: a 14px label, for a compact control in a card header. */
    size?: 'md' | 'sm';
    className?: string;
  }
>(function Checkbox(
  {
    label,
    description,
    partial = false,
    error,
    size = 'md',
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref
) {
  const ownId = useId();
  const inputId = id ?? ownId;
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;
  const inner = useRef<HTMLInputElement | null>(null);

  // `indeterminate` is a DOM property only, so it is set after render.
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = partial;
  }, [partial]);

  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const describedBy =
    [ariaDescribedBy, description && descriptionId, error && errorId].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={inputId}
        // The square sits on the first line, so a label that wraps reads like a paragraph.
        className="group/cb flex cursor-pointer items-start gap-3 has-disabled:cursor-not-allowed pointer-coarse:min-h-11 pointer-coarse:py-2.5"
      >
        <span className="relative grid size-5 shrink-0">
          <input
            ref={setRef}
            id={inputId}
            type="checkbox"
            aria-checked={partial ? 'mixed' : undefined}
            aria-invalid={error ? true : ariaInvalid}
            aria-describedby={describedBy}
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              'col-start-1 row-start-1 rounded-md border-[1.5px] border-gray-300 bg-surface transition-colors duration-120 ease-out',
              'group-hover/cb:peer-enabled:border-gray-400 group-hover/cb:peer-enabled:bg-hover',
              'peer-checked:border-brand-solid peer-checked:bg-brand-solid peer-indeterminate:border-brand-solid peer-indeterminate:bg-brand-solid',
              'group-hover/cb:peer-enabled:peer-checked:border-brand-solid-hover group-hover/cb:peer-enabled:peer-checked:bg-brand-solid-hover',
              'group-hover/cb:peer-enabled:peer-indeterminate:border-brand-solid-hover group-hover/cb:peer-enabled:peer-indeterminate:bg-brand-solid-hover',
              'peer-aria-invalid:border-error-600',
              'peer-disabled:border-gray-200 peer-disabled:bg-gray-100',
              'peer-disabled:peer-checked:border-gray-300 peer-disabled:peer-checked:bg-gray-300',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#5a9ef2]'
            )}
          />
          <Check
            aria-hidden
            size={12}
            strokeWidth={3}
            className="col-start-1 row-start-1 hidden place-self-center text-white peer-checked:block peer-checked:peer-indeterminate:hidden"
          />
          <span
            aria-hidden
            className="col-start-1 row-start-1 hidden h-0.5 w-2 place-self-center rounded bg-white peer-indeterminate:block"
          />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              'leading-[1.4] text-gray-900 group-has-disabled/cb:text-gray-400',
              size === 'sm' ? 'text-[14px] font-medium' : 'text-[15px] large-text:text-[17px]'
            )}
          >
            {label}
          </span>
          {description && (
            <span
              id={descriptionId}
              className="text-[14px] leading-[1.4] text-gray-500 group-has-disabled/cb:text-gray-400"
            >
              {description}
            </span>
          )}
        </span>
      </label>
      {error && (
        <div className="pl-8">
          <FieldError id={errorId}>{error}</FieldError>
        </div>
      )}
    </div>
  );
});

/**
 * The 20px square alone, for rows that are already a `button role="checkbox"` (the confirm
 * dialog option, the event drawer's campus list): the button carries the state, this draws it.
 */
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
        'grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] text-white transition-colors duration-120 ease-out',
        on ? 'border-brand-solid bg-brand-solid' : 'border-gray-300 bg-surface',
        className
      )}
    >
      {checked ? (
        <Check size={12} strokeWidth={3} />
      ) : partial ? (
        <span className="h-0.5 w-2 rounded bg-white" />
      ) : null}
    </span>
  );
}
