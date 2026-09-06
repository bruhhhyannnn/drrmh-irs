'use client';

import { cn } from '@/lib';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface TableActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const baseActionClass =
  'inline-flex items-center gap-1.5 text-sm transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-50';

export function EditAction({
  onClick,
  disabled,
  title = 'Edit',
  className,
}: TableActionButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        baseActionClass,
        'hover:text-brand-600 dark:hover:text-brand-400 text-gray-400 dark:text-gray-500',
        className
      )}
    >
      <Pencil size={15} />
      {title}
    </button>
  );
}

export function ViewAction({
  onClick,
  href,
  disabled,
  title = 'View',
  className,
}: TableActionButtonProps & { href?: string }) {
  const cls = cn(
    baseActionClass,
    'hover:text-brand-600 dark:hover:text-brand-400 text-gray-400 dark:text-gray-500',
    className
  );

  if (href) {
    return (
      <Link href={href} title={title} className={cls}>
        <Eye size={15} />
        {title}
      </Link>
    );
  }

  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={cls}>
      <Eye size={15} />
      {title}
    </button>
  );
}

export function DeleteAction({
  onClick,
  disabled,
  title = 'Delete',
  className,
}: TableActionButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        baseActionClass,
        'hover:text-error-500 text-gray-400 dark:text-gray-500',
        className
      )}
    >
      <Trash2 size={15} />
      {title}
    </button>
  );
}

export function TableActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-row items-center gap-3">{children}</div>;
}
