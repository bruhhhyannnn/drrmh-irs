'use client';

import { Button, FOCUS_RING } from '@/components/ds';
import { useCampusesOverview } from '@/components/hooks/use-campus';
import { cn } from '@/lib';
import { AlertTriangle, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '../_components/page-header';
import { CampusMark, Card, Chip, Mono, Skeleton } from '../_components/ui';
import { plural } from '../_lib/format';
import { CampusDrawer } from './_components/campus-drawer';

export default function CampusPage() {
  const { data: campuses, isPending, error } = useCampusesOverview();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Campus"
        subtitle={
          campuses
            ? `${plural(campuses.length, 'campus', 'campuses')}. Open one to see its events and reports.`
            : 'Open a campus to see its events and reports.'
        }
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            Add campus
          </Button>
        }
      />

      {error ? (
        <Card className="p-6 text-[15px] text-[#b42318]">
          The campuses couldn&apos;t be loaded: {error.message}
        </Card>
      ) : isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : campuses.length === 0 ? (
        <Card className="p-10 text-center text-[15px] text-gray-500">
          No campuses yet. Add the first one to start creating events.
        </Card>
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campuses.map((campus) => {
            const stats = [
              { label: 'Events', value: campus._count.events },
              { label: 'Users', value: campus._count.users },
              { label: 'Fields', value: campus._count.population_categories },
            ];
            return (
              <li key={campus.id}>
                <Link
                  href={`/campus/details?id=${campus.id}`}
                  className={cn(
                    'flex min-w-0 flex-col gap-4 rounded-[22px] border border-gray-200 bg-white p-5 text-gray-900 shadow-[0_1px_3px_rgba(16,24,40,.08)] transition-shadow hover:border-gray-300 hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,.10)]',
                    FOCUS_RING
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <CampusMark name={campus.name} />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      <span className="text-[17px] leading-tight font-bold">{campus.name}</span>
                      <Chip tone={campus.is_active ? 'green' : 'grey'} dot>
                        {campus.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    </div>
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 border-t border-[#eaecf0] pt-3.5">
                    {stats.map((s) => (
                      <div key={s.label} className="flex flex-col gap-0.5">
                        <dt className="text-[12px] font-medium text-gray-500">{s.label}</dt>
                        <dd
                          className={cn(
                            'font-landing-mono text-[17px] font-bold',
                            s.value ? 'text-gray-900' : 'text-gray-400'
                          )}
                        >
                          <Mono>{s.value}</Mono>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {campus._count.population_categories === 0 && (
                    <div className="bg-warning-50 flex items-start gap-2 rounded-[14px] px-3 py-2.5 text-[13px] leading-[1.45] font-medium text-[#93370d]">
                      <AlertTriangle
                        size={16}
                        aria-hidden
                        className="mt-px shrink-0 text-[#b54708]"
                      />
                      <span>
                        No population fields yet, so ERT headcount has nothing to fill in.
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CampusDrawer open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
