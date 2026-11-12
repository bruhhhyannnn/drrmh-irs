'use client';

import { FOCUS_RING } from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { useDashboard } from '@/components/hooks/use-dashboard';
import { cn } from '@/lib';
import { useAuthStore } from '@/store';
import { eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth } from 'date-fns';
import { CalendarDays, ChartNoAxesColumn, TriangleAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '../_components/page-header';
import { useEventTitle, useScopedCampusId } from '../_components/shell/campus-switcher';
import {
  Bar,
  Card,
  CardHeading,
  Chip,
  DateBlock,
  EmptyNote,
  Mono,
  Skeleton,
} from '../_components/ui';
import { formatDate, formatEventWindow, formatTime, plural } from '../_lib/format';
import { capitalize, eventTone } from '../_lib/status';
import { BuildingSafety } from './_components/building-safety/building-safety';
import { CampusesStrip } from './_components/campuses-strip';
import { NeedsAttention } from './_components/needs-attention';

type Dashboard = NonNullable<ReturnType<typeof useDashboard>['data']>;

/** "Good morning", "Good afternoon" or "Good evening", by the admin's clock. */
function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const campusId = useScopedCampusId();
  const { data: campuses = [] } = useCampuses();
  const { data, isPending, error } = useDashboard(campusId || undefined);
  const firstName = useAuthStore((s) => s.userProfile?.first_name?.trim());
  const campusName = campusId ? campuses.find((c) => c.id === campusId)?.name : 'All campuses';

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        subtitle={`${campusName ?? 'All campuses'} · ${format(new Date(), 'EEEE, MMMM d, yyyy')}`}
      />
      {error ? (
        <Card className="p-6 text-[17px] text-error-700">
          The dashboard couldn&apos;t be loaded: {error.message}
        </Card>
      ) : isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <NeedsAttention data={data} />
          <CampusesStrip campusId={campusId} />
          <StatTiles data={data} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportsByCluster data={data} />
            <EventsByStatus data={data} />
          </div>
          <BuildingSafety />
          <MonthCard data={data} />
        </>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading the dashboard…</span>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

/* ─── Tiles ──────────────────────────────────────────────────────────────────────────── */

function StatTiles({ data }: { data: Dashboard }) {
  const { counts } = data;
  const tiles = [
    {
      label: 'Events',
      value: counts.events,
      sub: `${counts.ongoing} ongoing · ${counts.upcoming} upcoming`,
      href: '/events',
      icon: <CalendarDays size={18} aria-hidden />,
      accent: false,
    },
    {
      label: 'Reports',
      value: counts.reports,
      sub: counts.reportsThisWeek
        ? `+${counts.reportsThisWeek.toLocaleString()} this week`
        : 'None this week',
      href: '/reports',
      icon: <ChartNoAxesColumn size={18} aria-hidden />,
      accent: false,
    },
    {
      label: 'Users',
      value: counts.users,
      sub: counts.incompleteProfiles
        ? `${plural(counts.incompleteProfiles, 'profile', 'profiles')} incomplete`
        : 'All profiles complete',
      href: '/users',
      icon: <Users size={18} aria-hidden />,
      accent: false,
    },
    {
      label: 'Bystander reports',
      value: counts.pendingBystander,
      sub: counts.pendingBystander ? 'need review' : 'None to review',
      href: '/emergency-reports',
      icon: <TriangleAlert size={18} aria-hidden />,
      accent: true,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          className={cn(
            'flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-gray-200 bg-surface px-4.5 py-4 text-gray-900 shadow-[0_1px_3px_rgba(16,24,40,.06)] transition-[border-color,box-shadow,translate] duration-120 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_10px_24px_rgba(16,24,40,.12)] motion-reduce:hover:translate-y-0',
            FOCUS_RING
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[14px] leading-[1.3] font-semibold text-gray-600">{t.label}</span>
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-[10px]',
                t.accent ? 'bg-brand-25 text-brand-500' : 'bg-gray-100 text-gray-600'
              )}
            >
              {t.icon}
            </span>
          </div>
          <Mono className="text-[30px] leading-[1.1] font-extrabold">
            {t.value.toLocaleString()}
          </Mono>
          <span
            className={cn('text-[14px] font-medium', t.accent ? 'text-brand-500' : 'text-gray-500')}
          >
            {t.sub}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ─── Charts ─────────────────────────────────────────────────────────────────────────── */

function ReportsByCluster({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.clusters.map((c) => c.reports));
  return (
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <CardHeading title="Reports by cluster" aside="All events" />
      {data.clusters.length ? (
        <ul className="flex flex-col gap-2.5">
          {data.clusters.map((c) => (
            <li key={c.id} className="grid grid-cols-[96px_minmax(0,1fr)_36px] items-center gap-3">
              <span className="truncate text-[14px] font-semibold text-gray-700" title={c.name}>
                {c.name}
              </span>
              <Bar value={c.reports} max={max} />
              <Mono className="text-right text-[14px] font-semibold">{c.reports}</Mono>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>No reports yet.</EmptyNote>
      )}
    </Card>
  );
}

const STATUS_ROWS = [
  { key: 'ongoing', label: 'Ongoing', color: '#12b76a' },
  { key: 'upcoming', label: 'Upcoming', color: '#f79009' },
  { key: 'completed', label: 'Completed', color: '#2e90fa' },
] as const;

function EventsByStatus({ data }: { data: Dashboard }) {
  const rows = STATUS_ROWS.map((r) => ({ ...r, count: data.counts[r.key] }));
  return (
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <CardHeading title="Events by status" aside={plural(data.counts.events, 'event', 'events')} />
      <div aria-hidden className="flex h-3 gap-0.75 overflow-hidden rounded-full bg-gray-100">
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <div key={r.key} style={{ flexGrow: r.count, flexBasis: 0, background: r.color }} />
          ))}
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2.5 border-b border-line py-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: r.color }}
            />
            <span className="flex-1 text-[16px] font-medium text-gray-700">{r.label}</span>
            <Mono className="text-[16px] font-semibold">{r.count}</Mono>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─── This month ─────────────────────────────────────────────────────────────────────── */

const DOT = { ongoing: 'bg-success-500', upcoming: 'bg-warning-500', completed: 'bg-info-500' };

function MonthCard({ data }: { data: Dashboard }) {
  const eventTitle = useEventTitle();
  const today = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });
  const leading = getDay(days[0]);
  const events = data.month.map((e) => ({ ...e, startedAt: new Date(e.startedAt) }));

  return (
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <CardHeading
        title={format(today, 'MMMM yyyy')}
        aside={`${plural(events.length, 'event', 'events')} this month`}
      />
      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden grid-cols-7 gap-0.5 md:grid" aria-hidden>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span
              key={i}
              className="grid h-6 place-items-center text-[12px] font-semibold text-gray-500"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: leading }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map((day) => {
            const on = isSameDay(day, today);
            const dayEvents = events.filter((e) => isSameDay(e.startedAt, day));
            const status = dayEvents[0]?.status as keyof typeof DOT | undefined;
            return (
              <span
                key={day.toISOString()}
                className={cn(
                  'font-landing-mono relative grid h-9 place-items-center rounded-[10px] text-[14px]',
                  on ? 'bg-brand-solid font-bold text-white' : 'font-medium text-gray-700'
                )}
              >
                {day.getDate()}
                {dayEvents.length > 0 && (
                  <span
                    className={cn(
                      'absolute bottom-1 left-1/2 size-1.25 -translate-x-1/2 rounded-full',
                      on ? 'bg-white' : (status && DOT[status]) || 'bg-gray-400'
                    )}
                  />
                )}
              </span>
            );
          })}
        </div>
        {events.length ? (
          <ul className="flex flex-col">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/details?id=${e.id}`}
                  className={cn(
                    'flex items-center gap-3.5 rounded-lg border-b border-line py-3 hover:bg-gray-25',
                    FOCUS_RING
                  )}
                >
                  <DateBlock date={e.startedAt} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                    <span className="text-[17px] leading-[1.3] font-semibold">
                      {eventTitle(e.name, e.campus)}
                    </span>
                    <span className="text-[14px] text-gray-500">
                      {formatEventWindow(e.startedAt, e.endedAt).split(' · ')[1] ??
                        formatTime(e.startedAt)}
                    </span>
                  </div>
                  <Chip tone={eventTone(e.status)} dot>
                    {capitalize(e.status)}
                  </Chip>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[16px] text-gray-500">
            No events this month. The next one is{' '}
            {data.nextEvent?.startedAt
              ? `on ${formatDate(data.nextEvent.startedAt)}`
              : 'not scheduled yet'}
            .
          </p>
        )}
      </div>
    </Card>
  );
}
