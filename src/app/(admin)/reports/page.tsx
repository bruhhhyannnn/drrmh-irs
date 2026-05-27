'use client';

import type { getBystanderReports } from '@/actions/emergency-reports';
import type { getReports } from '@/actions/reports';
import { useBystanderReports } from '@/app/(admin)/emergency-reports/use-bystander-reports';
import { PageBreadcrumb } from '@/components/common';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Input,
  Modal,
  PageError,
  Pagination,
} from '@/components/ui';
import { useAuthStore } from '@/store';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { CheckCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ReportForm } from './report-form';
import { useDeleteReport, useReports, useVerifyReport } from './use-reports';

type ReportRow = Awaited<ReturnType<typeof getReports>>['data'][number];
type BystanderRow = Awaited<ReturnType<typeof getBystanderReports>>[number];
type Tab = 'verified' | 'bystander';

const PER_PAGE = 10;

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<Tab>('verified');
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, isFetching, error } = useReports(
    page,
    debounceQuery,
    activeTab === 'verified'
  );

  const {
    data: bystanderData,
    isPending: bystanderPending,
    isFetching: bystanderFetching,
    error: bystanderError,
  } = useBystanderReports(debounceQuery, { enabled: activeTab === 'bystander' });

  const deleteReport = useDeleteReport();
  // TODO: might reconsider
  const verifyReport = useVerifyReport();

  const [editId, setEditId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [verifyId, setVerifyId] = useState('');

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
    setQuery('');
  };

  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE);

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Verified report columns ──────────────────────────────
  const reportColumns: ColumnDef<ReportRow, unknown>[] = [
    {
      id: 'cluster',
      header: 'Cluster',
      accessorFn: (r) => r.cluster.name,
      cell: ({ row: { original: r } }) => (
        <Badge color="primary" size="sm">
          {r.cluster.name}
        </Badge>
      ),
    },
    {
      id: 'unit',
      header: 'Unit',
      accessorFn: (r) => r.unit?.name ?? '',
      cell: ({ row: { original: r } }) => r.unit?.name ?? '—',
    },
    {
      id: 'location',
      header: 'Location',
      accessorFn: (r) => r.location?.name ?? '',
      cell: ({ row: { original: r } }) => (
        <span className="max-w-50 truncate">{r.location?.name ?? '—'}</span>
      ),
    },
    {
      id: 'total_affected',
      header: 'Total Affected',
      accessorFn: (r) => totalAffected(r),
      cell: ({ row: { original: r } }) => <span className="font-medium">{totalAffected(r)}</span>,
    },
    {
      id: 'casualties',
      header: 'Casualties',
      accessorFn: (r) => r.casualties_count ?? 0,
      cell: ({ row: { original: r } }) =>
        (r.casualties_count ?? 0) > 0 ? (
          <Badge color="error" size="sm">
            {r.casualties_count}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        ),
    },
    {
      id: 'missing',
      header: 'Missing',
      accessorFn: (r) => r.missing_count ?? 0,
      cell: ({ row: { original: r } }) =>
        (r.missing_count ?? 0) > 0 ? (
          <Badge color="warning" size="sm">
            {r.missing_count}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (r) => r.created_at ?? '',
      cell: ({ row: { original: r } }) =>
        r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row: { original: r } }) => (
        <div className="flex flex-row items-center gap-3">
          <button
            className="hover:text-brand-600 dark:hover:text-brand-400 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100 dark:text-gray-500"
            onClick={() => {
              setIsModalOpen(true);
              setEditId(r.id);
            }}
          >
            <Pencil size={17} />
          </button>
          <button
            className="hover:text-error-500 text-gray-400 transition-all duration-100 dark:text-gray-500"
            onClick={() => setDeleteId(r.id)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  // ── Bystander report columns ─────────────────────────────
  const bystanderColumns: ColumnDef<BystanderRow, unknown>[] = [
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
      accessorFn: (r) => r.clusters.name,
      cell: ({ row: { original: r } }) => r.clusters.name,
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
      accessorFn: (r) => r.report_missing_persons.length,
      cell: ({ row: { original: r } }) =>
        r.report_missing_persons.length > 0 ? (
          <Badge color="warning" size="sm">
            {r.report_missing_persons.length}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        ),
    },
    {
      id: 'casualties',
      header: 'Casualties',
      accessorFn: (r) => r.report_casualties.length,
      cell: ({ row: { original: r } }) =>
        r.report_casualties.length > 0 ? (
          <Badge color="error" size="sm">
            {r.report_casualties.length}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => r.bystander_report_statuses?.name ?? '',
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
      id: 'date',
      header: 'Submitted',
      accessorFn: (r) => r.submitted_at ?? '',
      cell: ({ row: { original: r } }) =>
        r.submitted_at ? format(new Date(r.submitted_at), 'MMM d, yyyy') : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row: { original: r } }) => (
        <div className="flex flex-row items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-2.5 py-1 text-sm font-medium text-green-700 transition-colors duration-150 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
            onClick={() => setVerifyId(r.id)}
          >
            <CheckCircle size={15} />
            Verify
          </button>
          <button
            className="hover:text-error-500 text-gray-400 transition-all duration-100 dark:text-gray-500"
            onClick={() => setDeleteId(r.id)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  if (error) return <PageError message={error.message} />;
  if (bystanderError) return <PageError message={bystanderError.message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Reports" />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          <TabButton
            label="Verified Reports"
            active={activeTab === 'verified'}
            onClick={() => handleTabChange('verified')}
          />
          <TabButton
            label="Bystander Reports"
            active={activeTab === 'bystander'}
            onClick={() => handleTabChange('bystander')}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <Input
                placeholder={`Search ${activeTab === 'verified' ? 'verified' : 'bystander'} reports...`}
                className="pl-9"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeTab === 'verified'
                ? `${data?.total ?? 0} total`
                : `${bystanderData?.length ?? 0} total`}
            </p>
          </div>
          {activeTab === 'verified' && (
            <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
              Add Report
            </Button>
          )}
        </div>

        {activeTab === 'verified' ? (
          <>
            <DataTable
              columns={reportColumns}
              data={data?.data ?? []}
              loading={isPending || isFetching}
              emptyMessage="No verified reports found"
            />
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <DataTable
            columns={bystanderColumns}
            data={bystanderData ?? []}
            loading={bystanderPending || bystanderFetching}
            emptyMessage="No bystander reports found"
          />
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <ReportForm editId={editId} onSuccess={handleClose} onCancel={handleClose} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={() => deleteReport.mutate(deleteId, { onSuccess: () => setDeleteId('') })}
        title="Delete report"
        message="This report will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteReport.isPending}
      />

      <ConfirmDialog
        isOpen={!!verifyId}
        onClose={() => setVerifyId('')}
        onConfirm={() =>
          verifyReport.mutate(
            { reportId: verifyId, approved: true, adminId: user?.id ?? '' },
            { onSuccess: () => setVerifyId('') }
          )
        }
        title="Verify report"
        message="Mark this report as verified? It will move to the Verified Reports tab."
        confirmLabel="Verify"
        isLoading={verifyReport.isPending}
      />
    </>
  );
}

function TabButton({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
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
      {typeof count === 'number' && count > 0 && (
        <span className="bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400 rounded-full px-2 py-0.5 text-xs font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}

function totalAffected(r: ReportRow) {
  return (
    (r.students ?? 0) +
    (r.faculty_members ?? 0) +
    (r.admin_members ?? 0) +
    (r.reps_members ?? 0) +
    (r.ra_members ?? 0) +
    (r.philcare_staff ?? 0) +
    (r.security_personnel ?? 0) +
    (r.construction_workers ?? 0) +
    (r.tenants ?? 0) +
    (r.health_workers ?? 0) +
    (r.non_academic_staff ?? 0) +
    (r.guests ?? 0)
  );
}
