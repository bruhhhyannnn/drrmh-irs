'use client';

import { FOCUS_RING } from '@/components/ds';
import type { useDashboard } from '@/components/hooks/use-dashboard';
import { cn } from '@/lib';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronRight, ClipboardCheck, Radio, TriangleAlert, University } from 'lucide-react';
import Link from 'next/link';
import { useEventTitle, useIsSuperAdmin } from '../../_components/shell/campus-switcher';
import { Card } from '../../_components/ui';
import { formatTime, plural } from '../../_lib/format';

type Dashboard = NonNullable<ReturnType<typeof useDashboard>['data']>;

interface Item {
  key: string;
  title: string;
  sub: string;
  action: string;
  href: string;
  icon: React.ReactNode;
  tone: string;
  /** A live drill: a grey card so it stands apart from the to-dos. */
  live?: boolean;
}

/**
 * What to act on now, each a link and shown only when there is something: bystander reports to
 * review, each ongoing event, buildings that need structural follow-up and (super admins, all
 * campuses) campuses without population fields. Two columns on web.
 */
export function NeedsAttention({ data }: { data: Dashboard }) {
  const isSuperAdmin = useIsSuperAdmin();
  const eventTitle = useEventTitle();
  const { counts, attention } = data;

  const items: Item[] = [];
  if (counts.pendingBystander > 0) {
    items.push({
      key: 'bystander',
      title: `${plural(counts.pendingBystander, 'bystander report', 'bystander reports')} to review`,
      sub: attention.oldestPendingAt
        ? `Oldest sent ${formatDistanceToNowStrict(new Date(attention.oldestPendingAt))} ago`
        : 'Waiting for review',
      action: 'Bystander reports',
      href: '/emergency-reports',
      icon: <TriangleAlert size={20} aria-hidden />,
      tone: 'bg-error-50 text-error-700',
    });
  }
  for (const e of data.ongoing) {
    items.push({
      key: `live-${e.id}`,
      title: `${eventTitle(e.name, e.campus)} is live`,
      sub: [
        `${e.clustersReported} of ${plural(e.clustersTotal, 'cluster', 'clusters')} reported`,
        e.startedAt && `started ${formatTime(e.startedAt)}`,
      ]
        .filter(Boolean)
        .join(' · '),
      action: 'Open event',
      href: `/events/details?id=${e.id}`,
      icon: <Radio size={20} aria-hidden />,
      tone: 'bg-success-50 text-success-700',
      live: true,
    });
  }
  if (attention.followUpBuildings > 0) {
    items.push({
      key: 'follow-up',
      title: `${plural(attention.followUpBuildings, 'building needs', 'buildings need')} structural follow-up`,
      sub: 'Flagged by the checklist',
      action: 'Assessments',
      href: '/assessments?filter=follow-up',
      icon: <ClipboardCheck size={20} aria-hidden />,
      tone: 'bg-warning-50 text-warning-700',
    });
  }
  if (isSuperAdmin && attention.campusesWithoutFields > 0) {
    items.push({
      key: 'campuses',
      title: `${plural(attention.campusesWithoutFields, 'campus has', 'campuses have')} no population fields yet`,
      sub: 'ERT headcount has nothing to fill in there',
      action: 'Campus',
      href: '/campus',
      icon: <University size={20} aria-hidden />,
      tone: 'bg-gray-100 text-gray-600',
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] leading-[1.3] font-bold">Needs attention</h2>
        {items.length > 0 && (
          <span className="text-[14px] text-gray-500">
            {plural(items.length, 'thing', 'things')}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[16px] text-gray-600">Nothing needs attention right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={cn(
                  'group flex h-full items-center gap-3.5 rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-900 transition-[border-color,box-shadow,background-color] duration-120 ease-out hover:border-gray-300 hover:shadow-[0_10px_24px_rgba(16,24,40,.12)]',
                  item.live ? 'bg-gray-50' : 'bg-surface',
                  FOCUS_RING
                )}
              >
                <span
                  className={cn('grid size-10 shrink-0 place-items-center rounded-xl', item.tone)}
                >
                  {item.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[16px] leading-[1.35] font-bold text-pretty">
                    {item.title}
                  </span>
                  <span className="text-[14px] leading-[1.4] text-gray-500">{item.sub}</span>
                </span>
                <span className="text-brand-500 hidden shrink-0 items-center gap-1 text-[14px] font-bold whitespace-nowrap lg:flex">
                  {item.action}
                </span>
                <ChevronRight size={18} aria-hidden className="text-brand-500 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
