'use client';

import { PageBreadcrumb } from '@/components/common';
import { useCampuses } from '@/components/hooks/use-campus';
import { useDeleteEvent, useEvents } from '@/components/hooks/use-events';
import {
  Badge,
  Button,
  ConfirmDialog,
  DeleteAction,
  EditAction,
  Input,
  Modal,
  PageError,
  Select,
  Spinner,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ViewAction,
} from '@/components/ui';
import { format } from 'date-fns';
import { FileSpreadsheet, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EventForm } from './event-form';
import { exportEventToExcel } from './export-event';

export default function EventsPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [campusId, setCampusId] = useState('');
  const { data: campuses = [] } = useCampuses();
  const { data: events, isPending, isFetching, error } = useEvents(debouncedQuery, campusId);
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
            <p className="text-sm text-gray-500 dark:text-gray-400">{events?.length ?? 0} total</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
            Add Event
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Name</TableHead>
              <TableHead>Campus</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Reports Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events?.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  {event.name}
                </TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  {event.campus.name}
                </TableCell>
                <TableCell>
                  {event.started_at
                    ? format(new Date(event.started_at), 'MMM d, yyyy | h:mm a')
                    : '—'}
                </TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  {event._count.reports}
                </TableCell>
                <TableCell>
                  <Badge
                    color={
                      event.status.name.toLocaleLowerCase() === 'ongoing'
                        ? 'success'
                        : event.status.name.toLocaleLowerCase() === 'completed'
                          ? 'primary'
                          : 'warning'
                    }
                    size="sm"
                  >
                    {event.status.name}
                  </Badge>
                </TableCell>
                <TableCell>
                  <TableActions>
                    <ViewAction href={`/events/details?id=${event.id}`} title="View" />
                    <EditAction
                      onClick={() => {
                        setEditId(event.id);
                        setIsModalOpen(true);
                      }}
                    />
                    <button
                      onClick={() => handleExport(event.id)}
                      disabled={exportingId === event.id}
                      className="hover:text-brand-600 dark:hover:text-brand-400 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-500"
                      title="Export to Excel"
                    >
                      <FileSpreadsheet size={15} />
                      Export
                    </button>
                    <DeleteAction onClick={() => setDeleteId(event.id)} />
                  </TableActions>
                </TableCell>
              </TableRow>
            ))}
            {(isPending || isFetching) && (
              <TableRow>
                <TableCell className="py-10" colSpan={5}>
                  <Spinner center />
                </TableCell>
              </TableRow>
            )}
            {!events?.length && !isPending && !isFetching && (
              <TableRow>
                <TableCell className="py-10 text-center text-gray-400" colSpan={5}>
                  No events found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
