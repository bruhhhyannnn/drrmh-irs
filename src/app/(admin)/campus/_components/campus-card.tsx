'use client';

import type { CampusOverview } from '@/actions/campus-table';
import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { isToday } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Download,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { CampusMark, Chip, Mono } from '../../_components/ui';
import { formatDate, formatTime } from '../../_lib/format';
import { nsedTemplateFor } from '../../_lib/nsed-report';
import { capitalize, eventStatusKey, eventTone } from '../../_lib/status';
import { useExportNsed } from '../../events/_components/export-nsed';

export const campusHref = (id: string) => `/campus/details?id=${id}`;

/** Where a campus stands: with events, set up (has population fields) or not set up yet. */
export function campusStage(c: CampusOverview): 'events' | 'ready' | 'unset' {
  if (c._count.events > 0) return 'events';
  return c._count.population_categories > 0 ? 'ready' : 'unset';
}

const ACTION = cn(
  'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-bold whitespace-nowrap transition-[background-color,border-color,box-shadow] duration-120 ease-out',
  FOCUS_RING
);
const OUTLINE = cn(
  ACTION,
  'border-[1.5px] border-gray-300 bg-surface text-gray-900 hover:border-gray-400 hover:bg-hover'
);
const PRIMARY = cn(
  ACTION,
  'bg-brand-solid text-white hover:bg-brand-solid-hover hover:shadow-[0_6px_14px_rgba(161,29,29,.28)]'
);

/**
 * One campus: logo, name and state, its counts and its latest event with that event's exports
 * (Open event while it is ongoing). The name links to the campus page and its link covers the
 * card; the buttons sit above it and work on their own. `size="lg"` is the "With events" card
 * (80 px logo); `compact` drops the counts (the dashboard).
 */
export function CampusCard({
  campus,
  size = 'md',
  compact = false,
}: {
  campus: CampusOverview;
  size?: 'lg' | 'md';
  compact?: boolean;
}) {
  const { exportNsed, exporting } = useExportNsed();
  const stage = campusStage(campus);
  const event = campus.latestEvent;
  const status = event ? eventStatusKey(event.status.name) : null;
  const live = status === 'ongoing';
  const stats = [
    { label: 'Events', value: campus._count.events },
    { label: 'Users', value: campus._count.users },
    { label: 'Fields', value: campus._count.population_categories },
  ];
  const chip = live ? (
    <Chip tone="green" dot>
      Live
    </Chip>
  ) : stage === 'unset' ? (
    <Chip tone="grey" dot>
      Not set up
    </Chip>
  ) : (
    <Chip tone={campus.is_active ? 'green' : 'grey'} dot>
      {campus.is_active ? 'Active' : 'Inactive'}
    </Chip>
  );

  return (
    <article
      className={cn(
        'relative flex h-full min-w-0 flex-col gap-4 rounded-[22px] border border-gray-200 bg-surface p-5 text-gray-900 shadow-[0_1px_3px_rgba(16,24,40,.08)] transition-[border-color,box-shadow,translate] duration-120 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_10px_24px_rgba(16,24,40,.12)] motion-reduce:hover:translate-y-0'
      )}
    >
      <div className="flex items-center gap-3.5">
        <CampusMark name={campus.name} size={size === 'lg' ? 80 : 56} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <Link
            href={campusHref(campus.id)}
            className={cn(
              'rounded text-[19px] leading-tight font-bold after:absolute after:inset-0 after:rounded-[22px]',
              size === 'lg' && 'md:text-[22px]',
              FOCUS_RING
            )}
          >
            {campus.name}
          </Link>
          {chip}
        </div>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
      </div>

      {stage === 'unset' ? (
        <div className="bg-warning-50 flex items-start gap-2 rounded-[14px] px-3 py-2.5 text-[14px] leading-[1.45] font-medium text-warning-800">
          <AlertTriangle size={16} aria-hidden className="mt-px shrink-0 text-warning-700" />
          <span>No population fields yet, so ERT headcount has nothing to fill in.</span>
        </div>
      ) : (
        <>
          {!compact && (
            <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3.5">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5">
                  <dt className="text-[13px] font-medium text-gray-500">{s.label}</dt>
                  <dd
                    className={cn(
                      'text-[19px] font-bold',
                      s.value ? 'text-gray-900' : 'text-gray-400'
                    )}
                  >
                    <Mono>{s.value}</Mono>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {event ? (
            <div className="mt-auto flex flex-col gap-2 rounded-[16px] border border-line bg-gray-25 px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
                  Latest event
                </span>
                <Chip tone={eventTone(event.status.name)} dot>
                  {capitalize(event.status.name)}
                </Chip>
              </div>
              <span className="text-[17px] leading-tight font-bold">{event.name}</span>
              <span className="text-[14px] leading-[1.45] text-gray-600">
                {eventWhen(status, event.started_at, event.ended_at)} ·{' '}
                <Mono className="font-bold text-gray-900">{event._count.reports}</Mono>{' '}
                {event._count.reports === 1 ? 'report' : 'reports'} ·{' '}
                <Mono className="font-bold text-gray-900">{event.people.toLocaleString()}</Mono>{' '}
                {event.people === 1 ? 'person' : 'people'}
              </span>
              {/* Above the card's link, so they work on their own. */}
              <div className="relative z-10 mt-1 flex flex-wrap gap-2">
                {live ? (
                  <Link href={`/events/details?id=${event.id}`} className={PRIMARY}>
                    <ArrowRight size={16} aria-hidden />
                    Open event
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      className={OUTLINE}
                      onClick={() =>
                        window.open(`/events/report?id=${event.id}`, '_blank', 'noopener')
                      }
                    >
                      <Download size={16} aria-hidden />
                      Export PDF
                    </button>
                    {status === 'completed' && nsedTemplateFor(campus.name) && (
                      <button
                        type="button"
                        className={cn(OUTLINE, 'disabled:opacity-60')}
                        disabled={exporting === event.id}
                        onClick={() => exportNsed(event.id)}
                      >
                        <FileText size={16} aria-hidden />
                        {exporting === event.id ? 'Preparing…' : 'NSED report'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-auto flex items-center gap-2.5 rounded-[14px] border border-dashed border-gray-300 px-3.5 py-3 text-[15px] text-gray-600">
              <CalendarDays size={18} aria-hidden className="text-gray-500" />
              No events yet
            </div>
          )}
        </>
      )}
    </article>
  );
}

/** "Started today, 9:00 AM", "Completed Oct 8, 2026" or "Starts Dec 3, 2026, 2:00 PM". */
function eventWhen(
  status: ReturnType<typeof eventStatusKey> | null,
  started: Date | string | null,
  ended: Date | string | null
) {
  if (status === 'completed') return `Completed ${formatDate(ended ?? started)}`;
  if (!started) return 'No start time';
  if (status === 'ongoing') {
    return isToday(new Date(started))
      ? `Started today, ${formatTime(started)}`
      : `Started ${formatDate(started)}`;
  }
  return `Starts ${formatDate(started)}, ${formatTime(started)}`;
}

/** Heading of a campus section, with its count and an optional note. */
export function CampusSectionHeading({
  title,
  count,
  note,
}: {
  title: string;
  count: number;
  note?: string;
}) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-2 text-[19px] leading-tight font-bold">
      {title}
      <Mono className="text-[15px] font-bold text-gray-500">{count}</Mono>
      {note && <span className="text-[15px] font-medium text-gray-500">· {note}</span>}
    </h2>
  );
}
