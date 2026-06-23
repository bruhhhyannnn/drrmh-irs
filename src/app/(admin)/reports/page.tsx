'use client';

import type { getReports } from '@/actions/reports';
import { PageBreadcrumb } from '@/components/common';
import { useDeleteReport, useReports } from '@/components/hooks/use-reports';
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
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ReportForm } from './report-form';

type ReportRow = Awaited<ReturnType<typeof getReports>>['data'][number];

const PER_PAGE = 10;

export default function ReportsPage() {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, isFetching, error } = useReports(page, debounceQuery);

  const deleteReport = useDeleteReport();

  const [editId, setEditId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState('');

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE);

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Verified report columns ──────────────────────────────
  const reportColumns: ColumnDef<ReportRow, unknown>[] = [
    {
      id: 'date',
      header: 'Submitted',
      accessorFn: (r) => r.created_at ?? '',
      cell: ({ row: { original: r } }) =>
        r.created_at ? (
          <div className="text-sm">
            <div className="text-gray-800 dark:text-gray-200">
              {format(new Date(r.created_at), 'MMM d, yyyy')}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {format(new Date(r.created_at), 'h:mm a')}
            </div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      id: 'submitted_by',
      header: 'Submitted By',
      accessorFn: (r) => (r.user ? `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}` : ''),
      cell: ({ row: { original: r } }) =>
        r.user ? (
          <div className="text-sm">
            <div className="text-gray-800 dark:text-gray-200">
              {[r.user.first_name, r.user.last_name].filter(Boolean).join(' ')}
            </div>
            {r.user.position?.name && (
              <div className="text-xs text-gray-400 dark:text-gray-500">{r.user.position.name}</div>
            )}
          </div>
        ) : (
          '—'
        ),
    },
    {
      id: 'event',
      header: 'Event',
      accessorFn: (r) => r.event.name,
      cell: ({ row: { original: r } }) => (
        <span className="text-sm text-gray-800 dark:text-gray-200">{r.event.name}</span>
      ),
    },
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
      id: 'total_affected',
      header: 'Total Affected',
      accessorFn: (r) => totalAffected(r),
      cell: ({ row: { original: r } }) => <span className="font-medium">{totalAffected(r)}</span>,
    },
    {
      id: 'casualties',
      header: 'Casualties',
      accessorFn: (r) => r._count.casualties,
      cell: ({ row: { original: r } }) =>
        r._count.casualties > 0 ? (
          <Badge color="error" size="sm">
            {r._count.casualties}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        ),
    },
    {
      id: 'missing',
      header: 'Missing',
      accessorFn: (r) => r._count.missing_persons,
      cell: ({ row: { original: r } }) =>
        r._count.missing_persons > 0 ? (
          <Badge color="warning" size="sm">
            {r._count.missing_persons}
          </Badge>
        ) : (
          <span className="text-gray-500 dark:text-gray-600">0</span>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row: { original: r } }) => (
        <div className="flex flex-row items-center gap-3">
          {/* TODO: have another button here to view the individual report on its all details */}
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

  if (error) return <PageError message={error.message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Reports" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search
                size={16}
                className="absolute top-1/2 z-1 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <Input
                placeholder={`Search reports...`}
                className="pl-9"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{data?.total ?? 0} total</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
            Add Report
          </Button>
        </div>

        <DataTable
          columns={reportColumns}
          data={data?.data ?? []}
          loading={isPending || isFetching}
          emptyMessage="No verified reports found"
        />
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
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
    </>
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
