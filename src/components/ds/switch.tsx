'use client';

import { cn } from '@/lib';
import { FOCUS_RING } from './focus';

/** On / off switch: maroon when on. `sm` (40×24) sits in table rows, `md` (44×26) in forms. */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  describedBy,
  disabled,
  size = 'sm',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name when there is no visible label to point at. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'h-6 w-10' : 'h-6.5 w-11',
        checked ? 'bg-brand-500' : 'bg-gray-300',
        FOCUS_RING
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,.25)] transition-[left] duration-150',
          size === 'sm' ? 'top-0.5' : 'top-0.75',
          checked
            ? size === 'sm'
              ? 'left-4.5'
              : 'left-5.25'
            : size === 'sm'
              ? 'left-0.5'
              : 'left-0.75'
        )}
      />
    </button>
  );
}

/** A switch in a bordered box with its label and one line of help, for drawer forms. */
export function SwitchField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-[15px] large-text:text-[17px] font-semibold">
          {label}
        </span>
        {description && (
          <span
            id={`${id}-desc`}
            className="text-[13px] large-text:text-[14px] leading-[1.45] text-gray-500"
          >
            {description}
          </span>
        )}
      </div>
      <Switch
        size="md"
        checked={checked}
        onChange={onChange}
        labelledBy={`${id}-label`}
        describedBy={description ? `${id}-desc` : undefined}
      />
    </div>
  );
}
