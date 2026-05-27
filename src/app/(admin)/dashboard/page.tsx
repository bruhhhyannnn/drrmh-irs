'use client';

import { useEvents } from '@/app/(admin)/events/use-events';
import {
  useReportClusterSummary,
  useReports,
  useReportTotals,
} from '@/app/(admin)/reports/use-reports';
import { useUsers } from '@/app/(admin)/users/use-users';
import { PageBreadcrumb } from '@/components/common';
import { Badge } from '@/components/ui';
import { useThemeStore } from '@/store';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  FileText,
  Inbox,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CLUSTER_COLOR = '#a11d1d';

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#f59e0b',
  ongoing: '#22c55e',
  completed: '#3b82f6',
  unknown: '#9ca3af',
};

export default function DashboardPage() {
  const { data: events } = useEvents();
  const { data: reportsData } = useReports(1, '', true);
  const { data: users = [] } = useUsers();
  const { data: clusterSummary = [] } = useReportClusterSummary();
  const { data: totalAffected } = useReportTotals();
  const { theme } = useThemeStore();

  const stats = {
    events: events?.length,
    reports: reportsData?.total ?? 0,
    users: users.length,
  };

  const statusData = Object.entries(
    (events ?? []).reduce(
      (acc, e) => {
        const key = e.status?.name ?? 'Unknown';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex flex-col">
      <PageBreadcrumb pageTitle="Dashboard" />

      <div className="flex flex-col gap-4 xl:h-[calc(100vh-240px)] xl:flex-row">
        {/* RIGHT COLUMN */}
        <div className="w-full xl:h-full xl:w-1/3">
          <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between border-b border-gray-100 pb-3 dark:border-white/10">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent events</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Latest updates across the platform
                </p>
              </div>
            </div>

            <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
              {events?.length ? (
                events.map((event) => {
                  const statusLower = event.status.name.toLocaleLowerCase();
                  const badgeColor =
                    statusLower === 'ongoing'
                      ? 'success'
                      : statusLower === 'completed'
                        ? 'primary'
                        : 'warning';

                  return (
                    <Link
                      key={event.id}
                      href={`/events/details?id=${event.id}`}
                      className="group flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm dark:border-white/5 dark:bg-white/5 dark:hover:border-white/10 dark:hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate text-sm font-medium text-gray-900 dark:text-white">
                            {event.name}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <CalendarDays size={12} />
                            <span>
                              {event.started_at
                                ? format(new Date(event.started_at), 'MMM d, yyyy')
                                : 'No date set'}
                            </span>
                          </div>
                        </div>
                        <Badge
                          color={badgeColor}
                          size="sm"
                          className="shrink-0 px-2 py-1 text-[10px] leading-none font-medium"
                        >
                          {event.status.name}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <EmptyState message="No recent events" />
              )}
            </div>

            {events && events.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/10">
                <Link
                  href="/events"
                  className="text-brand-600 hover:text-brand-400 dark:text-brand-400 dark:hover:text-brand-300 flex items-center justify-center gap-1 text-xs font-medium transition-colors"
                >
                  View all events
                  <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* LEFT COLUMN */}
        <div className="flex w-full flex-col gap-4 xl:w-2/3">
          {/* Stats grid — 2 cols on sm+, 4 on xl */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              title="Total Events"
              value={stats?.events ?? '—'}
              icon={<CalendarDays size={20} />}
              color="brand"
              trend="Events in total"
            />
            <StatCard
              title="Total Reports"
              value={stats?.reports ?? '—'}
              icon={<FileText size={20} />}
              color="success"
              trend="Reports from all clusters"
            />
            <StatCard
              title="Total Users"
              value={stats?.users ?? '—'}
              icon={<Users size={20} />}
              color="warning"
              trend="Registered users"
            />
            <StatCard
              title="Active Incidents"
              value={
                (totalAffected?.casualties ?? 0) +
                (totalAffected?.missing ?? 0) +
                (totalAffected?.reports ?? 0)
              }
              icon={<AlertTriangle size={20} />}
              color="error"
              trend="Total affected across all events"
            />
          </div>

          {/* Charts */}
          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Events by Status */}
            <div className="flex min-h-72 flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Events by status
                </h3>
                <Activity className="text-gray-400 dark:text-gray-500" size={16} />
              </div>
              <div className="flex flex-1 items-center justify-center">
                {statusData.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={4}
                      >
                        {statusData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              STATUS_COLORS[entry.name.toLocaleLowerCase()] ?? STATUS_COLORS.unknown
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background:
                            theme === 'dark' ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
                          border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: theme === 'dark' ? '#f9fafb' : '#111827',
                          fontSize: '14px',
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#f9fafb' : '#111827' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={24}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '14px', paddingTop: '10px', color: 'inherit' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No event data" />
                )}
              </div>
            </div>

            {/* Reports by Cluster */}
            <div className="flex min-h-72 flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Reports by cluster
                </h3>
                <Activity className="text-gray-400 dark:text-gray-500" size={16} />
              </div>
              <div className="flex flex-1 items-center justify-center">
                {clusterSummary.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={clusterSummary}
                      margin={{ top: 10, right: 0, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(156,163,175,0.15)"
                      />
                      <XAxis
                        dataKey="cluster"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                        dy={8}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{
                          fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        }}
                        contentStyle={{
                          background:
                            theme === 'dark' ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
                          border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: theme === 'dark' ? '#f9fafb' : '#111827',
                          fontSize: '14px',
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#f9fafb' : '#111827' }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                      />
                      <Bar
                        dataKey="reports"
                        name="Reports"
                        fill={CLUSTER_COLOR}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="casualties"
                        name="Casualties"
                        fill="#ef4444"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="missing"
                        name="Missing"
                        fill="#f59e0b"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No cluster reports" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color = 'brand',
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'brand' | 'success' | 'warning' | 'error';
  trend?: string;
}) {
  const styles = {
    brand: {
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-500/10',
      iconBg: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      iconBg: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
    },
  };

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
          {value === undefined || value === null ? (
            <div className="h-6 w-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {value}
            </p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[color].iconBg}`}
        >
          {icon}
        </div>
      </div>
      {trend && <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">{trend}</div>}
      <div
        className={`pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 rounded-full blur-2xl ${styles[color].bg}`}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 dark:border-white/10 dark:bg-white/5">
      <Inbox className="mb-2 text-gray-300 dark:text-gray-600" size={24} />
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
