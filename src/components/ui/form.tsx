import { cn } from '@/lib';
import { Check, ChevronsUpDown } from 'lucide-react';
import React, { forwardRef, useState } from 'react';
import { Dropdown, DropdownItem } from './dropdown';

/* ─── Label ─── */
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, required, className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400', className)}
      {...props}
    >
      {children}
      {required && <span className="text-error-500 ml-1">*</span>}
    </label>
  )
);
Label.displayName = 'Label';

/* ─── Input ─── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
  success?: boolean;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, success, hint, className, id, required, ...props }, ref) => {
    return (
      <div className="relative">
        {label && (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </Label>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          className={cn(
            'shadow-theme-xs h-11 w-full rounded-lg border bg-gray-100 px-4 py-2.5 text-sm transition-all duration-200 placeholder:text-gray-400 focus:ring-3 focus:outline-none dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30',
            error
              ? 'border-error-500 text-error-800 focus:ring-error-500/10 dark:border-error-500 dark:text-error-400'
              : success
                ? 'border-success-400 text-success-500 focus:ring-success-500/10 dark:border-success-500 dark:text-success-400'
                : 'focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 border-gray-300 text-gray-800 dark:border-gray-700',
            props.disabled &&
              'cursor-not-allowed border-gray-300 bg-gray-50 text-gray-500 dark:bg-gray-800',
            className
          )}
          {...props}
        />
        {hint && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-error-500' : success ? 'text-success-500' : 'text-gray-500'
            )}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

/* ─── Select ─── */
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  label?: string;
  placeholder?: string;
  error?: boolean;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  /** Show a search input inside the dropdown panel — useful for long option lists. */
  searchable?: boolean;
  /** Allow clearing back to the placeholder (e.g. for filter dropdowns). */
  allowClear?: boolean;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      onBlur,
      name,
      label,
      placeholder = 'Select an option',
      error,
      hint,
      disabled,
      required,
      className,
      id,
      searchable,
      allowClear,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const selected = options.find((opt) => opt.value === value);

    return (
      <div>
        {label && (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <button
            ref={ref}
            type="button"
            id={id}
            name={name}
            disabled={disabled}
            onClick={() => setIsOpen((p) => !p)}
            onBlur={onBlur}
            className={cn(
              'dropdown-toggle shadow-theme-xs flex h-11 w-full items-center justify-between rounded-lg border bg-gray-100 px-4 py-2.5 text-left text-sm focus:ring-3 focus:outline-none dark:bg-gray-900 dark:text-white/90',
              selected ? 'text-gray-800 dark:text-white/90' : 'text-gray-400 dark:text-white/30',
              error
                ? 'border-error-500 focus:ring-error-500/10'
                : 'focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 border-gray-300 dark:border-gray-700',
              disabled &&
                'cursor-not-allowed border-gray-300 bg-gray-50 text-gray-500 dark:bg-gray-800',
              className
            )}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown size={16} className="ml-2 shrink-0 text-gray-400 dark:text-gray-500" />
          </button>
          <Dropdown
            isOpen={isOpen && !disabled}
            onClose={() => setIsOpen(false)}
            className="w-full"
            searchable={searchable}
          >
            {allowClear && (
              <DropdownItem
                onClick={() => {
                  onChange?.('');
                  setIsOpen(false);
                }}
              >
                <span className="italic text-gray-400 dark:text-gray-500">{placeholder}</span>
              </DropdownItem>
            )}
            {options.map((opt) => (
              <DropdownItem
                key={opt.value}
                className={cn(
                  opt.value === value &&
                    'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white',
                  opt.disabled && 'pointer-events-none opacity-40'
                )}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange?.(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
        {hint && (
          <p className={cn('mt-1.5 text-xs', error ? 'text-error-500' : 'text-gray-500')}>{hint}</p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

/* ─── Checkbox ─── */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className, ...props }, ref) => {
    const box = (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          className={cn(
            'peer checked:border-brand-500 checked:bg-brand-500 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900',
            className
          )}
          {...props}
        />
        <Check
          size={12}
          strokeWidth={3}
          className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
    );

    if (!label) return box;

    return (
      <label
        htmlFor={id}
        className={cn(
          'inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300',
          props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        )}
      >
        {box}
        {label}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

/* ─── Textarea ─── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: boolean;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, required, ...props }, ref) => (
    <div>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </Label>
      )}
      <textarea
        ref={ref}
        id={id}
        required={required}
        className={cn(
          'shadow-theme-xs w-full rounded-lg border bg-gray-100 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:ring-3 focus:outline-none dark:bg-gray-900 dark:text-white/90',
          error
            ? 'border-error-500 focus:ring-error-500/10'
            : 'focus:border-brand-300 focus:ring-brand-500/10 border-gray-300 dark:border-gray-700',
          className
        )}
        {...props}
      />
      {hint && (
        <p className={cn('mt-1.5 text-xs', error ? 'text-error-500' : 'text-gray-500')}>{hint}</p>
      )}
    </div>
  )
);
Textarea.displayName = 'Textarea';
