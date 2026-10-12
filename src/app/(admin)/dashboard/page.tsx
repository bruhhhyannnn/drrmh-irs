'use client';

import { ButtonLink, FOCUS_RING } from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { useDashboard } from '@/components/hooks/use-dashboard';
import { cn } from '@/lib';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isToday,
  isTomorrow,
  startOfMonth,
} from 'date-fns';
import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  Plus,
  TriangleAlert,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '../_components/page-header';
import {
  useEventTitle,
  useIsSuperAdmin,
  useScopedCampusId,
} from '../_components/shell/campus-switcher';
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

type Dashboard = NonNullable<ReturnType<typeof useDashboard>['data']>;

export default function DashboardPage() {
  const campusId = useScopedCampusId();
  const { data: campuses = [] } = useCampuses();
  const { data, isPending, error } = useDashboard(campusId || undefined);
  const campusName = campusId ? campuses.find((c) => c.id === campusId)?.name : 'All campuses';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${campusName ?? 'All campuses'} · ${format(new Date(), 'EEEE, MMMM d, yyyy')}`}
      />
      {error ? (
        <Card className="p-6 text-[17px] text-[#b42318]">
          The dashboard couldn&apos;t be loaded: {error.message}
        </Card>
      ) : isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <OngoingNow data={data} />
          <StatTiles data={data} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportsByCluster data={data} />
            <EventsByStatus data={data} />
          </div>
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

/* ─── Ongoing now ────────────────────────────────────────────────────────────────────── */

function OngoingNow({ data }: { data: Dashboard }) {
  // Administrators see one campus, so its ongoing events stack full width.
  const isSuperAdmin = useIsSuperAdmin();
  return (
    <section className="flex flex-col gap-3" aria-labelledby="ongoing-now">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ongoing-now" className="text-[19px] leading-[1.3] font-bold">
          Ongoing now
        </h2>
        <Link
          href="/events"
          className={cn('text-brand-500 rounded text-[16px] font-bold hover:underline', FOCUS_RING)}
        >
          All events
        </Link>
      </div>
      {data.ongoing.length ? (
        <div
          className={cn(
            'grid grid-cols-1 items-start gap-4',
            isSuperAdmin && 'md:grid-cols-2 lg:grid-cols-3'
          )}
        >
          {data.ongoing.map((e) => (
            <OngoingCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <NothingOngoing next={data.nextEvent} />
      )}
    </section>
  );
}

function OngoingCard({ event }: { event: Dashboard['ongoing'][number] }) {
  const eventTitle = useEventTitle();
  const stats = [
    { label: 'Reports', value: event.reports, tone: 'text-gray-900' },
    { label: 'Casualties', value: event.casualties, tone: 'text-[#b42318]' },
    { label: 'Missing', value: event.missing, tone: 'text-[#b54708]' },
  ];
  return (
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <div className="flex">
        <Chip tone="green" dot>
          Ongoing
        </Chip>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[20px] leading-[1.3] font-bold text-balance">
          {eventTitle(event.name, event.campus)}
        </h3>
        <span className="text-[14px] text-gray-500">
          {event.startedAt
            ? `Started ${formatDate(event.startedAt)} · ${formatTime(event.startedAt)}`
            : 'No start time set'}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold text-gray-700">Clusters reported</span>
          <Mono className="text-[16px] font-bold">
            {event.clustersReported} of {event.clustersTotal}
          </Mono>
        </div>
        <Bar value={event.clustersReported} max={event.clustersTotal} size="sm" />
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-[#eaecf0] pt-3.5">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[13px] font-medium text-gray-500">{s.label}</dt>
            <dd
              className={cn(
                'font-landing-mono text-[22px] leading-[1.2] font-bold',
                s.value ? s.tone : 'text-gray-400'
              )}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <ButtonLink href={`/events/details?id=${event.id}`} variant="outline" size="sm" fullWidth>
        Open summary
        <ChevronRight size={16} aria-hidden />
      </ButtonLink>
    </Card>
  );
}

function nextLabel(date: Date | null) {
  if (!date) return 'Next · no start time set';
  const day = isToday(date) ? 'today' : isTomorrow(date) ? 'tomorrow' : format(date, 'EEE, MMM d');
  return `Next · ${day}, ${format(date, 'h:mm a')}`;
}

function NothingOngoing({ next }: { next: Dashboard['nextEvent'] }) {
  const isSuperAdmin = useIsSuperAdmin();
  const startedAt = next?.startedAt ? new Date(next.startedAt) : null;
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4.5 md:p-6">
      <div className="flex min-w-0 flex-[1_1_280px] items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600">
          <CalendarDays size={20} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[19px] leading-[1.3] font-bold">No event is ongoing</span>
          <span className="text-[16px] leading-normal text-pretty text-gray-600">
            ERT members can send status reports only while an event is ongoing. Set the event to
            Ongoing when the drill starts.
          </span>
        </div>
      </div>
      {next ? (
        <Link
          href={`/events/details?id=${next.id}`}
          className={cn(
            'flex min-w-0 flex-[1_1_300px] items-center gap-3.5 rounded-2xl border border-[#eaecf0] bg-gray-50 px-3.5 py-3 text-gray-900 hover:border-gray-300',
            FOCUS_RING
          )}
        >
          {startedAt ? (
            <DateBlock date={startedAt} tone="white" />
          ) : (
            <span className="grid h-13 w-12 shrink-0 place-items-center rounded-[14px] border border-[#eaecf0] bg-white text-gray-400">
              <CalendarDays size={18} aria-hidden />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.75">
            <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
              {nextLabel(startedAt)}
            </span>
            <span className="text-[17px] leading-[1.3] font-semibold">{next.name}</span>
            {/* Super admins see which campuses run it; administrators, what it is. */}
            {isSuperAdmin ? (
              <span className="text-[14px] leading-[1.4] text-gray-500">
                {next.campuses.join(', ')}
              </span>
            ) : (
              next.description && (
                <span className="truncate text-[14px] leading-[1.4] text-gray-500">
                  {next.description}
                </span>
              )
            )}
          </div>
          <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
        </Link>
      ) : (
        <div className="flex flex-[1_1_300px] items-center justify-center">
          <ButtonLink href="/events?add=1" size="sm">
            <Plus size={16} aria-hidden />
            Add event
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

/* ─── Tiles ──────────────────────────────────────────────────────────────────────────── */

function StatTiles({ data }: { data: Dashboard }) {
  const { counts } = data;
  const tiles = [
    {
      label: 'Events',
      value: counts.events,
      sub: counts.ongoing ? `${counts.ongoing} ongoing` : `${counts.upcoming} upcoming`,
      href: '/events',
      icon: <CalendarDays size={18} aria-hidden />,
      accent: false,
    },
    {
      label: 'Reports',
      value: counts.reports,
      sub: 'Across all events',
      href: '/reports',
      icon: <ChartNoAxesColumn size={18} aria-hidden />,
      accent: false,
    },
    {
      label: 'Users',
      value: counts.users,
      sub: 'Registered users',
      href: '/users',
      icon: <Users size={18} aria-hidden />,
      accent: false,
    },
    {
      label: 'Bystander reports',
      value: counts.pendingBystander,
      sub: 'Pending review',
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
            'flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-gray-200 bg-white px-4.5 py-4 text-gray-900 shadow-[0_1px_3px_rgba(16,24,40,.06)] hover:border-gray-300',
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
          <li key={r.key} className="flex items-center gap-2.5 border-b border-[#eaecf0] py-2.5">
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

const DOT = { ongoing: 'bg-success-500', upcoming: 'bg-warning-500', completed: 'bg-[#2e90fa]' };

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
                  on ? 'bg-brand-500 font-bold text-white' : 'font-medium text-gray-700'
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
                    'flex items-center gap-3.5 rounded-lg border-b border-[#eaecf0] py-3 hover:bg-gray-25',
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
