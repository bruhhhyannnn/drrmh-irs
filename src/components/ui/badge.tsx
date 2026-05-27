import { cn } from '@/lib';
import React from 'react';

type BadgeVariant = 'light' | 'solid';
type BadgeColor = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const colorMap = {
  light: {
    primary: 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400',
    success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
    error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
    warning: 'bg-warning-100 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
    info: 'bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400',
    light: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
    dark: 'bg-gray-500 text-white',
  },
  solid: {
    primary: 'bg-brand-500 text-white',
    success: 'bg-success-500 text-white',
    error: 'bg-error-500 text-white',
    warning: 'bg-warning-500 text-white',
    info: 'bg-blue-500 text-white',
    light: 'bg-gray-400 text-white',
    dark: 'bg-gray-700 text-white',
  },
};

export function Badge({
  variant = 'light',
  color = 'primary',
  size = 'md',
  startIcon,
  endIcon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full text-center font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm',
        colorMap[variant][color],
        className
      )}
    >
      {startIcon}
      {children}
      {endIcon}
    </span>
  );
}
