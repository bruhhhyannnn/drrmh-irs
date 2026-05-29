'use client';

import type { getReportsByEvent } from '@/actions/reports';
import { useEvent } from '@/app/(admin)/events/use-events';
import { useEventReports } from '@/app/(admin)/reports/use-reports';
import { PageBreadcrumb } from '@/components/common';
import { Badge, Spinner } from '@/components/ui';
import { getInitials } from '@/lib';
import { CLUSTERS, HEADCOUNT_FIELDS } from '@/types';
import { format } from 'date-fns';
import { AlertTriangle, Calendar, Clock, FileText, MapPin, Users, UserX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

// TODO: revalidate
type EventReport = Awaited<ReturnType<typeof getReportsByEvent>>[number];

// ─── Main content ─────────────────────────────────────────
function EventDetailsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('id') ?? undefined;

  const { data: event, isPending: loadingEvent } = useEvent(eventId);
  const { data: reports = [], isPending: loadingReports } = useEventReports(eventId);

  if (loadingEvent)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );

  if (!event) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-gray-400">Event not found</p>
      </div>
    );
  }

  // Group reports by cluster, respecting CLUSTERS order
  const reportsByCluster = CLUSTERS.reduce(
    (acc, cluster) => {
      acc[cluster] = reports.filter((r) => r.cluster.name === cluster);
      return acc;
    },
    {} as Record<string, EventReport[]>
  );

  // Clusters that actually have reports
  const activeClusters = CLUSTERS.filter((c) => reportsByCluster[c].length > 0);

  // Clusters that have zero reports (pending)
  const pendingClusters = CLUSTERS.filter((c) => reportsByCluster[c].length === 0);

  const totalCasualties = reports.reduce((s, r) => s + r.casualties.length, 0);
  const totalMissing = reports.reduce((s, r) => s + r.missing_persons.length, 0);
  const totalReports = reports.length;
  const totalAffected = reports.reduce(
    (s, r) => s + HEADCOUNT_FIELDS.reduce((sum, { key }) => sum + ((r as any)[key] ?? 0), 0),
    0
  );

  return (
    <div className="space-y-8">
      <PageBreadcrumb pageTitle="Event Details" />

      <div className="space-y-3">
        <div className="shadow-theme-sm rounded-xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/3">
          <div className="mt-2 flex flex-wrap gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.name}</h1>
            <div>
              {event.status.name && (
                <Badge
                  color={
                    event.status.name === 'ongoing'
                      ? 'success'
                      : event.status.name === 'completed'
                        ? 'primary'
                        : 'warning'
                  }
                  size="sm"
                >
                  {event.status.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Meta info row */}
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500">
            {event.started_at && (
              <div className="flex items-center gap-1.5">
                <Calendar size={14} />
                {format(new Date(event.started_at), 'MMM d, yyyy')}
              </div>
            )}
            {event.started_at && (
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                {format(new Date(event.started_at), 'h:mm a')}
                {event.ended_at && ` — ${format(new Date(event.ended_at), 'h:mm a')}`}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Affected"
            value={totalAffected.toLocaleString()}
            icon={<Users size={16} />}
          />
          <StatCard label="Reports Submitted" value={totalReports} icon={<FileText size={16} />} />
          <StatCard
            label="Total Casualties"
            value={totalCasualties}
            icon={<AlertTriangle size={16} />}
            accent={totalCasualties > 0}
          />
          <StatCard
            label="Missing Persons"
            value={totalMissing}
            icon={<UserX size={16} />}
            accent={totalMissing > 0}
          />
        </div>
      </div>

      {loadingReports ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
          <p className="text-sm text-gray-400">No reports submitted yet</p>
        </div>
      ) : (
        <>
          {/* Per-cluster board — Monday.com style */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Reports by Cluster
            </h2>
            <div className="space-y-6">
              {activeClusters.map((cluster) => (
                <ClusterCard key={cluster} cluster={cluster} reports={reportsByCluster[cluster]} />
              ))}
            </div>
          </div>

          {/* Pending clusters — clusters with no reports */}
          {pendingClusters.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Pending ({pendingClusters.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {pendingClusters.map((cluster) => (
                  <div
                    key={cluster}
                    className="flex flex-1 items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-600" />
                    {cluster}
                    <span className="text-xs text-gray-400 dark:text-gray-500">no reports</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* University grand total */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              University Total
            </h2>
            <GrandTotalCard reports={reports} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`shadow-theme-sm rounded-xl border p-4 ${
        accent
          ? 'border-error-200 bg-error-100 dark:border-error-500/20 dark:bg-error-500/10'
          : 'border-gray-200 bg-white dark:border-white/5 dark:bg-white/3'
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-medium ${accent ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {label}
        </p>
        <span className={accent ? 'text-error-500' : 'text-gray-400'}>{icon}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${accent ? 'dark:text-error-100' : 'text-gray-900 dark:text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Headcount breakdown row ──────────────────────────────
function HeadcountRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 tabular-nums dark:text-white">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ─── Cluster board card ───────────────────────────────────
function ClusterCard({ cluster, reports }: { cluster: string; reports: EventReport[] }) {
  const units = Array.from(new Set(reports.map((r) => r.unit?.name).filter(Boolean))) as string[];

  const [selectedUnit, setSelectedUnit] = useState<string | null>(units[0] ?? null);
  const filteredReports = selectedUnit
    ? reports.filter((r) => r.unit?.name === selectedUnit)
    : reports;

  const totals = reports.reduce(
    (acc, r) => {
      HEADCOUNT_FIELDS.forEach(({ key }) => {
        acc[key] = (acc[key] ?? 0) + ((r as any)[key] ?? 0);
      });
      return acc;
    },
    {} as Record<string, number>
  );

  const totalCasualties = reports.reduce((s, r) => s + r.casualties.length, 0);
  const totalMissing = reports.reduce((s, r) => s + r.missing_persons.length, 0);
  const totalAffected = HEADCOUNT_FIELDS.reduce((sum, { key }) => sum + (totals[key] ?? 0), 0);
  const hasCasualties = totalCasualties > 0;
  const hasMissing = totalMissing > 0;

  return (
    <div className="shadow-theme-md overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      {/* Cluster header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-white/5 dark:bg-white/2">
        <div className="flex items-center gap-3">
          <div className="bg-brand-500 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white">
            {getInitials(cluster)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{cluster}</p>
            <p className="text-xs text-gray-400">
              {reports.length} report{reports.length !== 1 ? 's' : ''} submitted
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasCasualties && (
            <Badge color="error" size="sm">
              {totalCasualties} {totalCasualties === 1 ? 'casualty' : 'casualties'}
            </Badge>
          )}
          {hasMissing && (
            <Badge color="warning" size="sm">
              {totalMissing} missing
            </Badge>
          )}
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900 tabular-nums dark:text-white">
              {totalAffected.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">total affected</p>
          </div>
        </div>
      </div>

      {/* Headcount summary */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 gap-x-8 divide-y divide-gray-100 sm:grid-cols-3 dark:divide-white/5">
          {HEADCOUNT_FIELDS.map(({ key, label }) => (
            <HeadcountRow key={key} label={label} value={totals[key] ?? 0} />
          ))}
        </div>
      </div>

      {/* Unit pill filters */}
      {units.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-5 py-3 dark:border-white/5">
          {units.map((unit) => (
            <button
              key={unit}
              onClick={() => setSelectedUnit(selectedUnit === unit ? null : unit)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 ${
                selectedUnit === unit
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-800 dark:border-white/10 dark:bg-white/3 dark:text-gray-400 dark:hover:border-white/30 dark:hover:text-gray-100'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      )}

      {/* Individual reports — always visible, filtered by selected unit */}
      <div className="border-t border-gray-100 dark:border-white/5">
        {filteredReports.map((r, i) => (
          <div
            key={r.id}
            className={`px-5 py-4 ${i !== filteredReports.length - 1 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {r.user ? `${r.user.first_name} ${r.user.last_name}` : '—'}
                </p>
                <p className="text-xs text-gray-400">
                  {r.unit?.name || '—'} · {r.user?.position?.name || '—'}
                </p>
              </div>
              <div className="flex gap-1.5">
                {r.casualties.length > 0 && (
                  <Badge color="error" size="sm">
                    {r.casualties.length} {r.casualties.length === 1 ? 'casualty' : 'casualties'}
                  </Badge>
                )}
                {r.missing_persons.length > 0 && (
                  <Badge color="warning" size="sm">
                    {r.missing_persons.length} missing
                  </Badge>
                )}
              </div>
            </div>

            {/* Mini headcount grid */}
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {HEADCOUNT_FIELDS.filter(({ key }) => (r as any)[key] > 0).map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-white/3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
                    {(r as any)[key]}
                  </p>
                </div>
              ))}
            </div>

            {/* Incident details */}
            {(r.missing_persons.length > 0 ||
              r.casualties.length > 0 ||
              r.damage_conditions !== null) && (
              <div className="mt-3 space-y-3">
                {r.missing_persons.length > 0 && (
                  <div className="border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/10 rounded-lg border p-3">
                    <p className="text-warning-700 dark:text-warning-400 mb-1.5 text-xs font-semibold tracking-wide uppercase">
                      Missing Persons ({r.missing_persons.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.missing_persons.map((p) => (
                        <span
                          key={p.name}
                          className="text-warning-800 dark:text-warning-300 rounded-md bg-white px-2 py-0.5 text-xs font-medium dark:bg-white/10"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {r.casualties.length > 0 && (
                  <div className="border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 rounded-lg border p-3">
                    <p className="text-error-700 dark:text-error-400 mb-1.5 text-xs font-semibold tracking-wide uppercase">
                      Casualties ({r.casualties.length})
                    </p>
                    <div className="space-y-1">
                      {r.casualties.map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
                          <span className="text-error-700 dark:text-error-300">
                            {c.name || '—'}
                          </span>
                          <span className="text-error-800 dark:text-error-200 shrink-0">
                            {c.condition.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.damage_conditions && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/5 dark:bg-white/2">
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                      Structural Damage
                    </p>
                    <span className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                      {r.damage_conditions.name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {r.location?.name && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                <MapPin size={11} />
                {r.location.name}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Grand total row ──────────────────────────────────────
function GrandTotalCard({ reports }: { reports: EventReport[] }) {
  const grandTotals = reports.reduce(
    (acc, r) => {
      HEADCOUNT_FIELDS.forEach(({ key }) => {
        acc[key] = (acc[key] ?? 0) + ((r as any)[key] ?? 0);
      });
      return acc;
    },
    {} as Record<string, number>
  );

  const totalCasualties = reports.reduce((s, r) => s + r.casualties.length, 0);
  const totalMissing = reports.reduce((s, r) => s + r.missing_persons.length, 0);
  const totalAffected = HEADCOUNT_FIELDS.reduce((sum, { key }) => sum + (grandTotals[key] ?? 0), 0);

  return (
    <div className="shadow-theme-md rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-white/5 dark:bg-white/2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">University Total</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
            {totalAffected.toLocaleString()}
            <span className="ml-1.5 text-sm font-normal text-gray-400">total affected</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4">
        {HEADCOUNT_FIELDS.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between border-b border-gray-100 py-1.5 text-sm dark:border-white/5"
          >
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="font-semibold text-gray-900 tabular-nums dark:text-white">
              {(grandTotals[key] ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      {(totalCasualties > 0 || totalMissing > 0) && (
        <div className="flex gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/5">
          {totalCasualties > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <AlertTriangle size={14} className="text-error-500" />
              <span className="text-error-600 dark:text-error-400 font-semibold">
                {totalCasualties} total casualties
              </span>
            </div>
          )}
          {totalMissing > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <UserX size={14} className="text-warning-500" />
              <span className="text-warning-600 dark:text-warning-400 font-semibold">
                {totalMissing} total missing
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventDetailsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EventDetailsContent />
    </Suspense>
  );
}
