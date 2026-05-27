'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Search, Eye, Plus, Pencil, Trash2 } from 'lucide-react';
import { useDeleteEvent, useEvents } from '@/hooks';
import { PageBreadcrumb } from '@/components/common';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Input,
  Spinner,
  PageError,
  Button,
  Modal,
  ConfirmDialog,
} from '@/components/ui';
import { EventForm } from '@/components/events';

export default function EventsPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { data: events, isPending, isFetching, error } = useEvents(debouncedQuery);
  const deleteEventMutation = useDeleteEvent();
  const [editId, setEditId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          <div className="relative max-w-sm min-w-2xs flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search events..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
            Add Event
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Name</TableHead>
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
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/events/details?id=${event.id}`}
                      className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100"
                    >
                      <Eye size={17} />
                    </Link>
                    <button
                      onClick={() => {
                        setEditId(event.id);
                        setIsModalOpen(true);
                      }}
                      className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="hover:text-error-500 text-gray-400 transition-all duration-100 dark:text-gray-500"
                      onClick={() => setDeleteId(event.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
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
        onConfirm={() => deleteEventMutation.mutate(deleteId, { onSuccess: () => setDeleteId('') })}
        title="Delete event"
        message="This event will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteEventMutation.isPending}
      />
    </>
  );
}
