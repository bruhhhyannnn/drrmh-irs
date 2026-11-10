'use client';

import { useScopedCampusId } from '@/app/(admin)/_components/shell/campus-switcher';
import { Card, EmptyNote, Skeleton } from '@/app/(admin)/_components/ui';
import { FOCUS_RING } from '@/components/ds';
import { usePillarMetrics } from '@/components/hooks/use-pillars';
import { cn } from '@/lib';
import { PILLARS } from '@/lib/pillars';
import Link from 'next/link';
import { Suspense } from 'react';
import { ScopeNote } from '../../_components/scope-note';
import { RecoveryViewSection } from './recovery-view';
import { ScoredViewSection } from './scored-view';
import { CampusPicker, usePillarView, ViewSwitch } from './shared';

function PillarMetricsContent({ slug }: { slug: string }) {
  const campusId = useScopedCampusId();
  const [view, setView] = usePillarView();
  const { data, isPending, error } = usePillarMetrics(slug, campusId);
  const pillarInfo = PILLARS.find((p) => p.slug === slug);
  const pillarName = pillarInfo?.name ?? 'Pillar';

  if (isPending) return <Skeleton className="h-96" />;
  if (error) {
    return (
      <Card className="text-error-700 p-6 text-[16px]">
        This pillar couldn&apos;t be loaded: {error.message}
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="p-6">
        <EmptyNote>Only administrators can see these results.</EmptyNote>
      </Card>
    );
  }

  const campusCount =
    data.kind === 'scored'
      ? data.campus.assessed
      : data.campus.in_place + data.campus.missing + data.campus.na;
  const offCampusCount =
    data.kind === 'scored'
      ? data.off_campus.assessed
      : data.off_campus.in_place + data.off_campus.missing + data.off_campus.na;

  return (
    <div className="flex flex-col gap-4">
      {/* Scope and Controls Card */}
      <Card className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <ScopeNote />
          <Link
            href="/pillars"
            className={cn('text-[14px] font-semibold text-brand-500 hover:underline', FOCUS_RING)}
          >
            All pillars
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-line border-t pt-3">
          <ViewSwitch
            view={view}
            onChange={setView}
            campusCount={campusCount}
            offCampusCount={offCampusCount}
          />
          <CampusPicker />
        </div>
      </Card>

      {/* Main Section */}
      {data.kind === 'scored' ? (
        <ScoredViewSection
          pillarName={pillarName}
          category={view}
          group={data[view]}
          campusTrend={data.campus.trend}
          offCampusTrend={data.off_campus.trend}
        />
      ) : (
        <RecoveryViewSection
          pillarName={pillarName}
          category={view}
          group={data[view]}
          campusTrend={data.campus.trend}
          offCampusTrend={data.off_campus.trend}
        />
      )}
    </div>
  );
}

/** A pillar's assessment results with tabs for Campus and Off-campus. */
export function PillarMetricsSection({ slug }: { slug: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PillarMetricsContent slug={slug} />
    </Suspense>
  );
}
