import React, { forwardRef } from 'react';
import { cn } from '@/lib';

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
          <label
            htmlFor={id}
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {required && <span className="text-error-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          className={cn(
            'shadow-theme-xs h-11 w-full rounded-lg border-2 bg-gray-100 px-4 py-2.5 text-sm transition-all duration-200 placeholder:text-gray-400 focus:ring-3 focus:outline-none dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30',
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
