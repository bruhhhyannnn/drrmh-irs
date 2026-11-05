'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { plural } from '../../_lib/format';
import type { ScopeTarget, UnitCoverage } from '../../_lib/summary';

/** Builds the link to a cluster or unit on the current page. */
export type ScopeLinks = (target: ScopeTarget) => string;

/** A row whose whole area follows the `DrillLink` inside it. */
export const DRILL_ROW = 'relative -mx-2 rounded-lg px-2 transition-colors hover:bg-gray-50';

export function DrillLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-sm after:absolute after:inset-0 after:rounded-lg',
        FOCUS_RING,
        className
      )}
    >
      <span className="min-w-0">{children}</span>
      <ChevronRight size={15} aria-hidden className="shrink-0 text-gray-400" />
    </Link>
  );
}

export function coverageLabel(coverage: UnitCoverage) {
  return `${coverage.reported} of ${plural(coverage.total, 'unit', 'units')}`;
}

/** A cluster's units with no report yet, collapsed until asked for. */
export function MissingUnits({
  coverage,
  className,
}: {
  coverage: UnitCoverage | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!coverage?.missing.length) return null;
  return (
    <div className={cn('flex flex-col', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-10 items-center gap-1.5 self-start rounded-lg text-left text-[14px] font-semibold text-warning-700',
          FOCUS_RING
        )}
      >
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        />
        {plural(coverage.missing.length, 'unit', 'units')} with no report yet
      </button>
      {open && (
        <ul className="flex flex-col gap-1 pb-1 pl-5.5 text-[16px] text-gray-600">
          {coverage.missing.map((u) => (
            <li key={u.id}>{u.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
