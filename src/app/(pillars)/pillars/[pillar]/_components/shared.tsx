'use client';

import { Card } from '@/app/(admin)/_components/ui';
import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { percent, type Tally } from '@/lib/assessment-score';
import type { BuildingCategory } from '@/lib/building-place';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export const TITLES: Record<BuildingCategory, string> = {
  campus: 'Campus',
  off_campus: 'Off-campus',
};

export const NONE: Record<BuildingCategory, string> = {
  campus: 'No campus assessments yet.',
  off_campus: 'No off-campus assessments yet.',
};

export const compareHref = (id: string, category: BuildingCategory) =>
  `/assessments?tab=compare&building=${id}${category === 'off_campus' ? '&category=off_campus' : ''}`;

export const buildingCount = (n: number) => `${n} ${n === 1 ? 'building' : 'buildings'} assessed`;
export const asPercent = (rate: number | null) =>
  rate === null ? '—' : `${Math.round(rate * 100)}%`;
export const pct = (t: Tally) => {
  const p = percent(t);
  return p === null ? '—' : `${p}%`;
};

export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return '';
  }
}

/** A building's name, linking to its history on the Assessments page. */
export function BuildingLink({
  id,
  name,
  label,
  category = 'campus',
}: {
  id: string;
  name: string;
  label?: string;
  category?: BuildingCategory;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        href={compareHref(id, category)}
        className={cn('text-brand-500 rounded font-semibold hover:underline', FOCUS_RING)}
      >
        {name}
      </Link>
      {label && <span className="text-[13px] text-gray-500">{label}</span>}
    </span>
  );
}

export { CampusPicker } from '../../_components/campus-picker';

export type PillarView = 'campus' | 'off_campus';

export function usePillarView(): [PillarView, (view: PillarView) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view: PillarView = searchParams.get('view') === 'off_campus' ? 'off_campus' : 'campus';

  const setView = (next: PillarView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'off_campus') {
      params.set('view', 'off_campus');
    } else {
      params.delete('view');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return [view, setView];
}

/** Switch between Campus and Off-campus views. */
export function ViewSwitch({
  view,
  onChange,
  campusCount,
  offCampusCount,
}: {
  view: PillarView;
  onChange: (view: PillarView) => void;
  campusCount: number;
  offCampusCount: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Campus or Off-campus view"
      className="inline-flex rounded-full bg-gray-100 p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'campus'}
        onClick={() => onChange('campus')}
        className={cn(
          'rounded-full px-4 py-1.5 text-[14px] font-semibold transition-all',
          view === 'campus'
            ? 'bg-surface font-bold text-gray-900 shadow-xs'
            : 'text-gray-600 hover:text-gray-900',
          FOCUS_RING
        )}
      >
        Campus · {campusCount} {campusCount === 1 ? 'building' : 'buildings'}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'off_campus'}
        onClick={() => onChange('off_campus')}
        className={cn(
          'rounded-full px-4 py-1.5 text-[14px] font-semibold transition-all',
          view === 'off_campus'
            ? 'bg-surface font-bold text-gray-900 shadow-xs'
            : 'text-gray-600 hover:text-gray-900',
          FOCUS_RING
        )}
      >
        Off-campus · {offCampusCount}
      </button>
    </div>
  );
}

/** Disclosure card for folded sections. */
export function FoldableCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-4.5 md:p-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 text-left text-[18px] font-bold text-gray-900',
          FOCUS_RING,
          'rounded-xl'
        )}
      >
        <span>{title}</span>
        <ChevronDown
          size={20}
          className={cn(
            'shrink-0 text-gray-500 transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {open && <div className="border-line mt-4 border-t pt-4">{children}</div>}
    </Card>
  );
}
