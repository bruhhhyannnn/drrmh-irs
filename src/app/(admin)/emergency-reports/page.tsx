'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Search, Eye, Trash2, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { useBystanderReports, useUpdateBystanderReportStatus, useDeleteReport } from '@/hooks';
import { PageBreadcrumb } from '@/components/common';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, Badge, Input, PageError, Modal, ConfirmDialog } from '@/components/ui';
import type { getBystanderReports } from '@/actions';

type BystanderRow = Awaited<ReturnType<typeof getBystanderReports>>[number];
type StatusFilter = 'all' | 'pending' | 'reviewed' | 'verified' | 'dismissed';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'verified', label: 'Verified' },
  { key: 'dismissed', label: 'Dismissed' },
];

export default function BystanderReportsPage() {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailRow, setDetailRow] = useState<BystanderRow | null>(null);
  const [deleteId, setDeleteId] = useState('');
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    status: 'reviewed' | 'verified' | 'dismissed';
  } | null>(null);

  const { data: reports = [], isPending, isFetching, error } = useBystanderReports(debounceQuery);
  const updateStatus = useUpdateBystanderReportStatus();
  const deleteReport = useDeleteReport();

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = reports.filter((r) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : (r.bystander_report_statuses?.name ?? 'pending') === statusFilter;

    const q = debounceQuery.toLowerCase();
    const matchesQuery =
      !q ||
      r.clusters?.name?.toLowerCase().includes(q) ||
      r.units?.name?.toLowerCase().includes(q) ||
      r.bystander_incident_types?.name?.toLowerCase().includes(q);
    // r.description?.toLowerCase().includes(q);

    return matchesStatus && matchesQuery;
  });

  const statusCounts = reports.reduce<Record<string, number>>(
    (acc, r) => {
      const s = r.bystander_report_statuses?.name ?? 'pending';
      acc[s] = (acc[s] ?? 0) + 1;
      acc['all'] = (acc['all'] ?? 0) + 1;
      return acc;
    },
    { all: 0, pending: 0, reviewed: 0, verified: 0, dismissed: 0 }
  );

  const columns: ColumnDef<BystanderRow, unknown>[] = [
    {
      id: 'incident_type',
      header: 'Incident Type',
      accessorFn: (r) => r.bystander_incident_types?.name ?? '',
      cell: ({ row: { original: r } }) => (
        <Badge color="primary" size="sm">
          {r.bystander_incident_types?.name ?? '—'}
        </Badge>
      ),
    },
    {
      id: 'cluster',
      header: 'Cluster',
      accessorFn: (r) => r.clusters?.name ?? '',
      cell: ({ row: { original: r } }) => r.clusters?.name ?? '—',
    },
    {
      id: 'unit',
      header: 'Unit',
      accessorFn: (r) => r.units?.name ?? '',
      cell: ({ row: { original: r } }) => r.units?.name ?? '—',
    },
    {
      id: 'missing',
      header: 'Missing',
      accessorFn: (r) => r.report_missing_persons?.length ?? 0,
      cell: ({ row: { original: r } }) => {
        const count = r.report_missing_persons?.length ?? 0;
        return count > 0 ? (
          <Badge color="warning" size="sm">
            {count}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        );
      },
    },
    {
      id: 'casualties',
      header: 'Casualties',
      accessorFn: (r) => r.report_casualties?.length ?? 0,
      cell: ({ row: { original: r } }) => {
        const count = r.report_casualties?.length ?? 0;
        return count > 0 ? (
          <Badge color="error" size="sm">
            {count}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => r.bystander_report_statuses?.name ?? 'pending',
      cell: ({ row: { original: r } }) => {
        const status = r.bystander_report_statuses?.name ?? 'pending';
        const color =
          status === 'verified'
            ? 'success'
            : status === 'reviewed'
              ? 'primary'
              : status === 'dismissed'
                ? 'error'
                : 'warning';
        return (
          <Badge color={color} size="sm">
            {status}
          </Badge>
        );
      },
    },
    {
      id: 'submitted',
      header: 'Submitted',
      accessorFn: (r) => r.submitted_at ?? '',
      cell: ({ row: { original: r } }) =>
        r.submitted_at ? format(new Date(r.submitted_at), 'MMM d, yyyy') : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row: { original: r } }) => {
        const status = r.bystander_report_statuses?.name ?? 'pending';
        return (
          <div className="flex flex-row items-center gap-2">
            {/* View detail */}
            <button
              title="View details"
              className="hover:text-brand-600 dark:hover:text-brand-400 inline-flex items-center gap-1 text-sm text-gray-400 transition-all duration-100 dark:text-gray-500"
              onClick={() => setDetailRow(r)}
            >
              <Eye size={17} />
            </button>

            {/* Mark reviewed */}
            {status === 'pending' && (
              <button
                title="Mark as reviewed"
                className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                onClick={() => setPendingStatus({ id: r.id, status: 'reviewed' })}
              >
                <BookOpen size={13} />
                Review
              </button>
            )}

            {/* Verify */}
            {(status === 'pending' || status === 'reviewed') && (
              <button
                title="Verify"
                className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
                onClick={() => setPendingStatus({ id: r.id, status: 'verified' })}
              >
                <CheckCircle size={13} />
                Verify
              </button>
            )}

            {/* Dismiss */}
            {status !== 'dismissed' && status !== 'verified' && (
              <button
                title="Dismiss"
                className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                onClick={() => setPendingStatus({ id: r.id, status: 'dismissed' })}
              >
                <XCircle size={13} />
                Dismiss
              </button>
            )}

            {/* Delete */}
            <button
              title="Delete"
              className="hover:text-error-500 text-gray-400 transition-all duration-100 dark:text-gray-500"
              onClick={() => setDeleteId(r.id)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        );
      },
    },
  ];

  if (error) return <PageError message={(error as Error).message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Bystander Reports" />

        {/* Status filter tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {STATUS_TABS.map(({ key, label }) => (
            <StatusTabButton
              key={key}
              label={label}
              count={statusCounts[key] ?? 0}
              active={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            />
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <Input
              placeholder="Search by incident type, cluster, unit…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'report' : 'reports'}
          </p>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={isPending || isFetching}
          emptyMessage="No bystander reports found"
        />
      </div>

      {/* Detail modal */}
      <Modal isOpen={!!detailRow} onClose={() => setDetailRow(null)}>
        {detailRow && (
          <BystanderReportDetail report={detailRow} onClose={() => setDetailRow(null)} />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={() => deleteReport.mutate(deleteId, { onSuccess: () => setDeleteId('') })}
        title="Delete bystander report"
        message="This report will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteReport.isPending}
      />

      {/* Status change confirm */}
      <ConfirmDialog
        isOpen={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => {
          if (!pendingStatus) return;
          updateStatus.mutate(pendingStatus, { onSuccess: () => setPendingStatus(null) });
        }}
        title={`Mark as ${pendingStatus?.status}`}
        message={STATUS_CONFIRM_MSG[pendingStatus?.status ?? 'reviewed']}
        confirmLabel={capitalize(pendingStatus?.status ?? '')}
        isLoading={updateStatus.isPending}
      />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusTabButton({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
        active
          ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BystanderReportDetail({
  report: r,
  onClose,
}: {
  report: BystanderRow;
  onClose: () => void;
}) {
  const status = r.bystander_report_statuses?.name ?? 'pending';
  const statusColor =
    status === 'verified'
      ? 'success'
      : status === 'reviewed'
        ? 'primary'
        : status === 'dismissed'
          ? 'error'
          : 'warning';

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bystander Report</h2>
          {r.submitted_at && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Submitted {format(new Date(r.submitted_at), 'MMMM d, yyyy · h:mm a')}
            </p>
          )}
        </div>
        <Badge color={statusColor} size="sm">
          {status}
        </Badge>
      </div>

      {/* Core info */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <DetailItem label="Incident Type" value={r.bystander_incident_types?.name} />
        <DetailItem label="Cluster" value={r.clusters?.name} />
        <DetailItem label="Unit" value={r.units?.name} />
        <DetailItem label="Missing Persons" value={String(r.report_missing_persons?.length ?? 0)} />
        <DetailItem label="Casualties" value={String(r.report_casualties?.length ?? 0)} />
      </dl>

      {/* Description */}
      {r.description && (
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Description
          </p>
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {r.description}
          </p>
        </div>
      )}

      {/* Missing persons list */}
      {(r.report_missing_persons?.length ?? 0) > 0 && (
        <PersonList title="Missing Persons" items={r.report_missing_persons} />
      )}

      {/* Casualties list */}
      {/* {(r.report_casualties?.length ?? 0) > 0 && (
        <PersonList title="Casualties" items={r.report_casualties} />
      )} */}

      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-gray-900 dark:text-white">{value ?? '—'}</dd>
    </div>
  );
}

function PersonList({ title, items }: { title: string; items?: { name?: string | null }[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((p, i) => (
          <li
            key={i}
            className="rounded-md bg-gray-50 px-3 py-1.5 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {p.name ?? `Person ${i + 1}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIRM_MSG: Record<string, string> = {
  reviewed: 'Mark this report as reviewed? The submitter will be notified.',
  verified: 'Mark this report as verified? It will be flagged as confirmed.',
  dismissed: 'Dismiss this report? It will be marked as not actionable.',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
