'use client';

import { FOCUS_RING } from '@/components/ds';
import { useCampusesOverview } from '@/components/hooks/use-campus';
import { cn } from '@/lib';
import Link from 'next/link';
import { useIsSuperAdmin } from '../../_components/shell/campus-switcher';
import { Skeleton } from '../../_components/ui';
import { CampusCard } from '../../campus/_components/campus-card';

/**
 * The campuses with events and their latest event, with the quick exports: two columns on web,
 * a sideways scroll on phone. One campus in scope (an administrator's, or the switcher's pick)
 * gets its full card, full width.
 */
export function CampusesStrip({ campusId }: { campusId: string }) {
  const isSuperAdmin = useIsSuperAdmin();
  const { data, isPending } = useCampusesOverview();

  if (isPending) return <Skeleton className="h-64" />;
  const campuses = (data ?? [])
    .filter((c) => (campusId ? c.id === campusId : c._count.events > 0))
    .sort((a, b) => b._count.events - a._count.events || a.name.localeCompare(b.name));
  if (!campuses.length) return null;
  const one = !!campusId;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="dashboard-campuses">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="dashboard-campuses" className="text-[19px] leading-[1.3] font-bold">
          {one ? 'Campus' : 'Campuses'}
        </h2>
        {isSuperAdmin && (
          <Link
            href="/campus"
            className={cn(
              'text-brand-500 rounded text-[16px] font-bold decoration-2 underline-offset-3 transition-colors duration-120 ease-out hover:text-brand-600 hover:underline',
              FOCUS_RING
            )}
          >
            All campuses
          </Link>
        )}
      </div>
      {one ? (
        <CampusCard campus={campuses[0]} size="lg" />
      ) : (
        <ul
          className={cn(
            // Phone: one card and the edge of the next, scrolled sideways; web: two columns.
            '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:items-stretch md:gap-4 md:overflow-visible md:px-0 md:pb-0'
          )}
        >
          {campuses.map((c) => (
            <li key={c.id} className="w-[85%] max-w-90 shrink-0 snap-start md:w-auto md:max-w-none">
              <CampusCard campus={c} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
