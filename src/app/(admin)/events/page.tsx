'use client';

import type { getEvents } from '@/actions/events';
import { PageBreadcrumb } from '@/components/common';
import { useCampuses } from '@/components/hooks/use-campus';
import { useDeleteEvent, useEvents } from '@/components/hooks/use-events';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DateTimeCell,
  Input,
  Modal,
  PageError,
  RowActions,
  Select,
} from '@/components/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, FileSpreadsheet, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { EventForm } from './event-form';
import { exportEventToExcel } from './export-event';

type EventRow = NonNullable<Awaited<ReturnType<typeof getEvents>>>[number];

export default function EventsPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [campusId, setCampusId] = useState('');
  const { data: campuses = [] } = useCampuses();
  const { data: events = [], isPending, isFetching, error } = useEvents(debouncedQuery, campusId);
  const deleteEventMutation = useDeleteEvent();
  const [editId, setEditId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportingId, setExportingId] = useState('');

  const handleExport = async (id: string) => {
    setExportingId(id);
    const toastId = toast.loading('Generating Excel file...');
    try {
      await exportEventToExcel(id);
      toast.success('Export ready.', { id: toastId });
    } catch {
      toast.error('Failed to export event. Please try again.', { id: toastId });
    } finally {
      setExportingId('');
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const columns = useMemo<ColumnDef<EventRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Event Name',
        accessorKey: 'name',
        cell: ({ row: { original: event } }) => (
          <span className="font-medium text-gray-900 dark:text-white">{event.name}</span>
        ),
      },
      {
        id: 'campus',
        header: 'Campus',
        accessorFn: (event) => event.campus.name,
        cell: ({ row: { original: event } }) => (
          <span className="text-gray-700 dark:text-gray-300">{event.campus.name}</span>
        ),
      },
      {
        id: 'started_at',
        header: 'Date & Time',
        accessorFn: (event) => event.started_at ?? '',
        cell: ({ row: { original: event } }) => <DateTimeCell date={event.started_at} />,
      },
      {
        id: 'reports',
        header: 'Reports',
        accessorFn: (event) => event._count.reports,
        cell: ({ row: { original: event } }) => (
          <span className="font-medium text-gray-900 dark:text-white">{event._count.reports}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (event) => event.status.name,
        cell: ({ row: { original: event } }) => {
          const statusLower = event.status.name.toLowerCase();
          return (
            <Badge
              color={
                statusLower === 'ongoing'
                  ? 'success'
                  : statusLower === 'completed'
                    ? 'primary'
                    : 'warning'
              }
              size="sm"
            >
              {event.status.name}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row: { original: event } }) => (
          <RowActions
            quickAction={{
              label: 'View details',
              icon: Eye,
              href: `/events/details?id=${event.id}`,
            }}
            actions={[
              {
                label: 'Edit event',
                icon: Pencil,
                onClick: () => {
                  setEditId(event.id);
                  setIsModalOpen(true);
                },
              },
              {
                label: exportingId === event.id ? 'Exporting...' : 'Export to Excel',
                icon: FileSpreadsheet,
                disabled: exportingId === event.id,
                onClick: () => handleExport(event.id),
              },
              {
                divider: true,
                label: 'Delete event',
                icon: Trash2,
                variant: 'danger',
                onClick: () => setDeleteId(event.id),
              },
            ]}
          />
        ),
        enableSorting: false,
      },
    ],
    [exportingId]
  );

  if (error) return <PageError message={error.message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Events" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-sm min-w-2xs flex-1">
              <Search
                size={16}
                className="absolute top-1/2 z-1 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <Input
                placeholder="Search events..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              placeholder="All campuses"
              className="w-full max-w-2xs"
              options={campuses.map((c) => ({ value: c.id, label: c.name }))}
              value={campusId}
              allowClear
              onChange={setCampusId}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{events.length} total</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
            Add Event
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={events}
          loading={isPending || isFetching}
          emptyMessage="No events found"
          emptyDescription="Create an event to start recording drill and incident reports."
          paginate
          pageSize={10}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <EventForm editId={editId} onSuccess={handleClose} onCancel={handleClose} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={() =>
          deleteEventMutation.mutate(deleteId, {
            onSuccess: () => {
              setDeleteId('');
              toast.success('Event deleted');
            },
            onError: (err) => toast.error(err.message),
          })
        }
        title="Delete event"
        message="This event will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteEventMutation.isPending}
      />
    </>
  );
}
