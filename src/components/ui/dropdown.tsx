'use client';

import { cn } from '@/lib';
import { Search } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Alignment relative to the trigger. Defaults to 'left'. */
  align?: 'left' | 'right';
  /** Show a search input pinned to the top of the dropdown that filters items by their text content. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Max height (in px) for the scrollable item list before it starts scrolling instead of overflowing the screen. Defaults to 280. */
  maxHeight?: number;
}

export function Dropdown({
  isOpen,
  onClose,
  children,
  className,
  align = 'left',
  searchable = false,
  searchPlaceholder = 'Search...',
  maxHeight = 280,
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('.dropdown-toggle')
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  if (!isOpen) return null;

  const query = search.trim().toLowerCase();
  const items = query
    ? React.Children.toArray(children).filter((child) => {
        if (!React.isValidElement(child)) return true;
        const text = getNodeText(child).toLowerCase();
        return text.includes(query);
      })
    : children;

  return (
    <div
      ref={ref}
      className={cn(
        'shadow-theme-lg dark:bg-gray-dark absolute z-50 mt-2 flex min-w-[200px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800',
        align === 'right' ? 'right-0' : 'left-0',
        className
      )}
    >
      {searchable && (
        <div className="relative shrink-0 border-b border-gray-100 p-2 dark:border-gray-800">
          <Search
            size={14}
            className="absolute top-1/2 left-4.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-2 pl-8 text-sm text-gray-800 placeholder-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder-gray-500"
          />
        </div>
      )}
      <div className="custom-scrollbar overflow-y-auto p-2" style={{ maxHeight }}>
        {searchable &&
        React.Children.count(children) > 0 &&
        items &&
        (Array.isArray(items) ? items.length === 0 : false) ? (
          <p className="px-3 py-2 text-center text-xs text-gray-400 dark:text-gray-500">
            No matches found
          </p>
        ) : (
          items
        )}
      </div>
    </div>
  );
}

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return '';
}

export function DropdownItem({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
        className
      )}
    >
      {children}
    </button>
  );
}
