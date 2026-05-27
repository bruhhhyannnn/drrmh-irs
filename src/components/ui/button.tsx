import { cn } from '@/lib';
import React, { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const variantClasses = {
  primary:
    'bg-brand-500 text-white shadow-lg hover:bg-brand-600 disabled:bg-brand-300 dark:disabled:bg-brand-800 ',
  outline:
    'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/5',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white hover:shadow-[inset_0_3px_4px_rgba(255,255,255,0.5),inset_0_-3px_4px_rgba(0,0,0,0.08)] dark:hover:shadow-[inset_0_3px_4px_rgba(255,255,255,0.06),inset_0_-3px_4px_rgba(0,0,0,0.35)]',
  danger:
    'bg-error-500 text-white hover:bg-error-600 disabled:bg-error-300 dark:disabled:bg-error-800',
};

const sizeClasses = {
  sm: 'px-2 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      startIcon,
      endIcon,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200',
          variantClasses[variant],
          sizeClasses[size],
          (disabled || isLoading) && 'cursor-not-allowed opacity-50',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingText ?? children}
          </>
        ) : (
          <>
            {startIcon}
            {children}
            {endIcon}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
