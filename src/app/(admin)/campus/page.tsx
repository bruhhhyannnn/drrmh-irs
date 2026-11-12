'use client';

import { Button } from '@/components/ds';
import { useCampusesOverview } from '@/components/hooks/use-campus';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../_components/page-header';
import { Card, Skeleton } from '../_components/ui';
import { plural } from '../_lib/format';
import { CampusCard, CampusSectionHeading, campusStage } from './_components/campus-card';
import { CampusDrawer } from './_components/campus-drawer';

/**
 * Every campus, in three sections: with events (most events first, so the order doesn't jump
 * around), set up with no events yet, and not set up yet. Cards in a row share one height.
 */
export default function CampusPage() {
  const { data: campuses, isPending, error } = useCampusesOverview();
  const [adding, setAdding] = useState(false);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const withEvents = (campuses ?? [])
    .filter((c) => campusStage(c) === 'events')
    .sort((a, b) => b._count.events - a._count.events || byName(a, b));
  const ready = (campuses ?? []).filter((c) => campusStage(c) === 'ready').sort(byName);
  const unset = (campuses ?? []).filter((c) => campusStage(c) === 'unset').sort(byName);

  return (
    <>
      <PageHeader
        title="Campus"
        subtitle={
          campuses
            ? `${plural(campuses.length, 'campus', 'campuses')}. Campuses with events come first.`
            : 'Campuses with events come first.'
        }
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            Add campus
          </Button>
        }
      />

      {error ? (
        <Card className="p-6 text-[17px] text-error-700">
          The campuses couldn&apos;t be loaded: {error.message}
        </Card>
      ) : isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : campuses.length === 0 ? (
        <Card className="p-10 text-center text-[17px] text-gray-500">
          No campuses yet. Add the first one to start creating events.
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {withEvents.length > 0 && (
            <section className="flex flex-col gap-3.5" aria-labelledby="campus-with-events">
              <div id="campus-with-events">
                <CampusSectionHeading
                  title="With events"
                  count={withEvents.length}
                  note="most events first"
                />
              </div>
              <ul className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                {withEvents.map((c) => (
                  <li key={c.id}>
                    <CampusCard campus={c} size="lg" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {ready.length > 0 && (
            <section className="flex flex-col gap-3.5" aria-labelledby="campus-ready">
              <div id="campus-ready">
                <CampusSectionHeading title="Set up, no events yet" count={ready.length} />
              </div>
              <ul className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ready.map((c) => (
                  <li key={c.id}>
                    <CampusCard campus={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {unset.length > 0 && (
            <section className="flex flex-col gap-3.5" aria-labelledby="campus-unset">
              <div id="campus-unset">
                <CampusSectionHeading
                  title="Not set up yet"
                  count={unset.length}
                  note="no population fields"
                />
              </div>
              <ul className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                {unset.map((c) => (
                  <li key={c.id}>
                    <CampusCard campus={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <CampusDrawer open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
