import { cn } from '@/lib';
import React from 'react';

export function Table({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div
      className={cn(
        'shadow-theme-xs overflow-hidden rounded-xl border border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900',
        containerClassName
      )}
    >
      <div className="max-w-full overflow-x-auto">
        <table className={cn('w-full border-collapse text-left text-sm', className)}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        'border-b border-gray-200/80 bg-gray-50/75 dark:border-gray-800 dark:bg-white/[0.02]',
        className
      )}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tbody className={cn('divide-y divide-gray-100 dark:divide-gray-800', className)}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn('transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.02]', className)}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'px-5 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400',
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn('px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300 align-middle', className)}
    >
      {children}
    </td>
  );
}
