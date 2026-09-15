'use client';

import { cn } from '@/lib';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export interface RowActionItem {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'danger' | 'success' | 'info';
  disabled?: boolean;
  divider?: boolean;
  hidden?: boolean;
  title?: string;
}

export interface RowActionsProps {
  /** Pinned primary action displayed directly as an icon button alongside the menu */
  quickAction?: RowActionItem;
  /** Secondary or all actions rendered inside the 3-dots (...) dropdown menu */
  actions: (RowActionItem | null | undefined | false)[];
  className?: string;
  /** Alignment of the dropdown menu. Defaults to 'end' (right aligned). */
  align?: 'start' | 'center' | 'end';
}

export function RowActions({ quickAction, actions, className, align = 'end' }: RowActionsProps) {
  const visibleActions = actions.filter((a): a is RowActionItem => Boolean(a && !a.hidden));

  const getItemClasses = (variant: RowActionItem['variant'] = 'default', disabled = false) =>
    cn(
      'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors select-none',
      disabled && 'pointer-events-none opacity-40 cursor-not-allowed',
      variant === 'default' &&
        'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-white/5 dark:hover:text-white',
      variant === 'danger' &&
        'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300',
      variant === 'success' &&
        'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300',
      variant === 'info' &&
        'text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300'
    );

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {/* Pinned Quick Action Button */}
      {quickAction && !quickAction.hidden && (
        <>
          {quickAction.href ? (
            <Link
              href={quickAction.href}
              title={quickAction.title ?? quickAction.label}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors',
                quickAction.disabled && 'pointer-events-none opacity-40'
              )}
            >
              {quickAction.icon ? <quickAction.icon size={15} /> : <Eye size={15} />}
            </Link>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                quickAction.onClick?.();
              }}
              disabled={quickAction.disabled}
              title={quickAction.title ?? quickAction.label}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {quickAction.icon ? <quickAction.icon size={15} /> : <Eye size={15} />}
            </button>
          )}
        </>
      )}

      {/* Overflow Dropdown Menu */}
      {visibleActions.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="More actions"
              title="More actions"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align={align}
              sideOffset={4}
              className="z-50 min-w-[170px] overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              {visibleActions.map((item, idx) => (
                <React.Fragment key={item.label + idx}>
                  {item.divider && (
                    <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
                  )}
                  <DropdownMenu.Item asChild>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className={getItemClasses(item.variant, item.disabled)}
                      >
                        {item.icon && <item.icon size={15} className="shrink-0" />}
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={item.disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onClick?.();
                        }}
                        className={getItemClasses(item.variant, item.disabled)}
                      >
                        {item.icon && <item.icon size={15} className="shrink-0" />}
                        <span>{item.label}</span>
                      </button>
                    )}
                  </DropdownMenu.Item>
                </React.Fragment>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

/* ─── Backwards-Compatible Helpers ─── */
interface TableActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  iconOnly?: boolean;
}

const baseActionClass =
  'inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export function EditAction({
  onClick,
  disabled,
  title = 'Edit',
  iconOnly = false,
  className,
}: TableActionButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        iconOnly
          ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-brand-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
          : cn(
              baseActionClass,
              'hover:text-brand-600 dark:hover:text-brand-400 text-gray-500 dark:text-gray-400'
            ),
        className
      )}
    >
      <Pencil size={15} />
      {!iconOnly && <span>{title}</span>}
    </button>
  );
}

export function ViewAction({
  onClick,
  href,
  disabled,
  title = 'View',
  iconOnly = false,
  className,
}: TableActionButtonProps & { href?: string }) {
  const cls = cn(
    iconOnly
      ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-brand-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
      : cn(
          baseActionClass,
          'hover:text-brand-600 dark:hover:text-brand-400 text-gray-500 dark:text-gray-400'
        ),
    className
  );

  if (href) {
    return (
      <Link href={href} title={title} className={cls}>
        <Eye size={15} />
        {!iconOnly && <span>{title}</span>}
      </Link>
    );
  }

  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={cls}>
      <Eye size={15} />
      {!iconOnly && <span>{title}</span>}
    </button>
  );
}

export function DeleteAction({
  onClick,
  disabled,
  title = 'Delete',
  iconOnly = false,
  className,
}: TableActionButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        iconOnly
          ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
          : cn(baseActionClass, 'hover:text-red-500 text-gray-500 dark:text-gray-400'),
        className
      )}
    >
      <Trash2 size={15} />
      {!iconOnly && <span>{title}</span>}
    </button>
  );
}

export function TableActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('inline-flex items-center gap-1', className)}>{children}</div>;
}
