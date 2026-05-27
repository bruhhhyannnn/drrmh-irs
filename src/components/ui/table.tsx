import { cn } from '@/lib';
import React from 'react';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="shadow-theme-md overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      <div className="max-w-full overflow-x-auto">
        <table className={cn('w-full border-collapse', className)}>{children}</table>
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
    <thead className={cn('border-b border-gray-100 dark:border-white/5', className)}>
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
    <tbody className={cn('divide-y divide-gray-100 dark:divide-white/5', className)}>
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
  return <tr className={cn('hover:bg-gray-50 dark:hover:bg-white/2', className)}>{children}</tr>;
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
        'text-md bg-gray-50 px-5 py-3 text-start font-medium text-gray-500 dark:bg-white/3 dark:text-gray-400',
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
    <td colSpan={colSpan} className={cn('px-5 py-3 text-gray-600 dark:text-gray-300', className)}>
      {children}
    </td>
  );
}
