import { cn } from '@/lib';
import { ChevronsUpDown } from 'lucide-react';
import React, { forwardRef } from 'react';

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

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  error?: boolean;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      label,
      placeholder = 'Select an option',
      error,
      hint,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => (
    <div>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'shadow-theme-xs h-11 w-full appearance-none rounded-lg border bg-gray-100 px-4 py-2.5 pr-10 text-sm focus:ring-3 focus:outline-none dark:bg-gray-900 dark:text-white/90',
            error
              ? 'border-error-500 focus:ring-error-500/10'
              : 'focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 border-gray-300 dark:border-gray-700',
            className
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          size={16}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />
      </div>
      {hint && (
        <p className={cn('mt-1.5 text-xs', error ? 'text-error-500' : 'text-gray-500')}>{hint}</p>
      )}
    </div>
  )
);
Select.displayName = 'Select';

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
