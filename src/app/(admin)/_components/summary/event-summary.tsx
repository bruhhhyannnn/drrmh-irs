'use client';

import { FOCUS_RING, Select } from '@/components/ds';
import { useCampusEventOptions, useEventSummarySource } from '@/components/hooks/use-events';
import { useCasualtyConditions, useDamageConditions } from '@/components/hooks/use-settings';
import { cn } from '@/lib';
import { ChartNoAxesColumn, X } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatDate, formatDateTime, formatEventWindow } from '../../_lib/format';
import {
  buildSummary,
  compareSummaries,
  resolveScope,
  scopeHref,
  scopeSource,
  type Summary,
  type SummarySource,
} from '../../_lib/summary';
import { useEventTitle } from '../shell/campus-switcher';
import { Mono, Skeleton } from '../ui';
import { ScopeBreadcrumb, UnitReportsCard, UnitsCard, type ScopeLinks } from './drill-down';
import {
  AnalyticsGrid,
  CasualtiesCard,
  ClustersCard,
  CompareCard,
  CompletedBanner,
  FirstReportChart,
  HeadcountCard,
  MissingCard,
  OverviewTiles,
  ReportsReceivedChart,
  TimelineCard,
} from './sections';

/** Active casualty and damage condition names from Settings, for the analytics legends. */
function useConditionLists() {
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [] } = useDamageConditions();
  return useMemo(
    () => ({
      casualtyConditions: casualtyConditions.filter((c) => c.is_active).map((c) => c.name),
      damageConditions: damageConditions.filter((c) => c.is_active).map((c) => c.name),
    }),
    [casualtyConditions, damageConditions]
  );
}

export function useSummary(source: SummarySource | null | undefined): Summary | null {
  const lists = useConditionLists();
  return useMemo(() => (source ? buildSummary(source, lists) : null), [source, lists]);
}

/**
 * The summary shared by campus details and event details: totals, clusters reported and not
 * yet, headcount, casualties, missing persons and analytics — with Compare with last drill
 * next to Overview. `before` renders above the summary (the campus page's event picker).
 * Mount with `key={eventId}` so a different event starts uncompared.
 */
export function EventSummary({
  eventId,
  before,
  linkParams,
}: {
  eventId: string;
  before?: React.ReactNode;
  /** Params the page needs in every cluster and unit link, beyond the ones already in its URL. */
  linkParams?: Record<string, string>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const links: ScopeLinks = (target) => scopeHref(pathname, searchParams, target, linkParams);
  const { data: source, isPending, error } = useEventSummarySource(eventId);
  const summary = useSummary(source);
  const clusterParam = searchParams.get('cluster');
  const unitParam = searchParams.get('unit');
  const { scope, invalid } = useMemo(
    () =>
      source
        ? resolveScope(source, { cluster: clusterParam, unit: unitParam })
        : { scope: null, invalid: false },
    [source, clusterParam, unitParam]
  );
  const scopedSource = useMemo(
    () => (source && scope ? scopeSource(source, scope) : null),
    [source, scope]
  );
  const narrowed = useSummary(scopedSource);
  const [compareId, setCompareId] = useState<string | null>(null);
  const { data: options = [] } = useCampusEventOptions(source?.event.campus_id);
  const { data: compareSource } = useEventSummarySource(compareId ?? undefined);
  const compareSummary = useSummary(compareId ? compareSource : null);
  const eventTitle = useEventTitle();

  const others = options.filter((o) => o.id !== eventId);
  const startedAt = source?.event.started_at ? new Date(source.event.started_at) : null;
  // The previous event at this campus, or the newest other one if none started earlier.
  const previous =
    others.find((o) => o.started_at && startedAt && new Date(o.started_at) < startedAt) ??
    others[0];

  if (error) {
    return (
      <p className="text-[17px] text-error-700">
        The summary couldn&apos;t be loaded: {error.message}
      </p>
    );
  }
  if (isPending || !summary) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Loading the summary…</span>
        <Skeleton className="h-8 w-60" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  // The sections read the narrowed summary; the completed banner speaks for the whole event.
  const view = narrowed ?? summary;
  const comparing = !scope && compareId && compareSummary;
  const title = eventTitle(summary.source.event.name, summary.source.event.campus.name);
  const picked = others.find((o) => o.id === compareId);
  const scopeName = scope && [scope.clusterName, scope.unitName].filter(Boolean).join(' › ');
  const heading = scopeName ? `${title} · ${scopeName}` : title;
  // A new scope starts the sections' own filters over, so a filter from another view can't hide
  // everything with its control gone.
  const scopeKey = scope ? `${scope.clusterId}/${scope.unitId ?? ''}` : 'event';

  return (
    <div className="flex flex-col gap-6">
      {summary.completed && <CompletedBanner summary={summary} />}
      {before}
      {scope && <ScopeBreadcrumb title={title} scope={scope} links={links} />}
      {invalid && (
        <p
          role="status"
          className="rounded-[18px] border border-gray-200 bg-surface px-4 py-3 text-[16px] text-gray-600"
        >
          That cluster or unit isn&apos;t part of this event, so the whole event is shown.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5 pt-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[22px] leading-[1.3] font-extrabold">Overview</h2>
          <span className="text-[16px] leading-[1.45] text-gray-500">
            {heading} · {summary.completed ? 'Completed' : 'As of'}{' '}
            <Mono className="text-[14px] font-semibold text-gray-700">
              {formatDateTime(summary.asOf)}
            </Mono>
          </span>
        </div>
        {!scope &&
          others.length > 0 &&
          (compareId ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-gray-600">Compared with</span>
              <div className="max-w-64 min-w-0">
                <Select
                  variant="filter"
                  label="Compare with event"
                  value={compareId}
                  onChange={setCompareId}
                  options={others.map((o) => ({
                    value: o.id,
                    label: `${o.name}${o.started_at ? ` · ${formatDate(o.started_at).replace(/, \d{4}$/, '')}` : ''}`,
                  }))}
                  className="h-10 rounded-xl font-semibold text-gray-900"
                />
              </div>
              <button
                type="button"
                aria-label="Stop comparing"
                title="Stop comparing"
                onClick={() => setCompareId(null)}
                className={cn(
                  'grid size-10 place-items-center rounded-full text-gray-600 hover:bg-gray-100',
                  FOCUS_RING
                )}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCompareId(previous?.id ?? null)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full border-[1.5px] border-gray-300 bg-surface px-4 text-[16px] font-bold whitespace-nowrap text-gray-700 hover:bg-gray-50',
                FOCUS_RING
              )}
            >
              <ChartNoAxesColumn size={16} aria-hidden />
              Compare with last drill
            </button>
          ))}
      </div>

      <OverviewTiles summary={view} scope={scope} />

      {!scope && compareId && !compareSummary && <Skeleton className="h-96" />}
      {comparing && (
        <>
          <CompareCard
            summary={summary}
            compare={compareSummary}
            rows={compareSummaries(summary, compareSummary)}
            description={[
              compareSummary.source.event.campus.name,
              formatEventWindow(
                compareSummary.source.event.started_at,
                compareSummary.source.event.ended_at
              ),
              picked?.id === previous?.id ? 'the previous drill at this campus' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <ReportsReceivedChart summary={summary} compare={compareSummary} />
            <FirstReportChart summary={summary} compare={compareSummary} />
          </div>
        </>
      )}

      {!scope && <ClustersCard summary={summary} links={links} />}
      {scope && !scope.unitId && (
        <UnitsCard key={scopeKey} summary={view} scope={scope} links={links} />
      )}
      {scope?.unitId && <UnitReportsCard summary={view} />}
      {/* A unit's page lists its reports already. */}
      {!scope?.unitId && <TimelineCard key={`timeline-${scopeKey}`} summary={view} />}
      <HeadcountCard key={`headcount-${scopeKey}`} summary={view} />
      <CasualtiesCard key={`casualties-${scopeKey}`} summary={view} />
      <MissingCard key={`missing-${scopeKey}`} summary={view} />

      {!scope?.unitId && (
        <>
          <div className="flex flex-col gap-1 pt-3">
            <h2 className="text-[22px] leading-[1.3] font-extrabold">Analytics</h2>
            <span className="text-[16px] leading-[1.45] text-pretty text-gray-500">
              {heading} · {summary.completed ? 'completed' : 'as of'} {formatDateTime(summary.asOf)}
            </span>
          </div>
          <AnalyticsGrid summary={view} scoped={!!scope} />
        </>
      )}
    </div>
  );
}
