'use client';

import { useDeleteEvent } from '@/components/hooks/use-events';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { useEventTitle } from '../../_components/shell/campus-switcher';
import { plural } from '../../_lib/format';

export interface DeletableEvent {
  id: string;
  name: string;
  campus: string;
  reports: number;
}

/** Names the event and its linked reports; reports are deleted with the event (cascade). */
export function DeleteEventDialog({
  event,
  onClose,
  onDeleted,
}: {
  event: DeletableEvent | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const deleteEvent = useDeleteEvent();
  const eventTitle = useEventTitle();
  return (
    <ConfirmDialog
      open={!!event}
      onClose={onClose}
      onConfirm={() =>
        event &&
        deleteEvent.mutate(event.id, {
          onSuccess: () => {
            toast.success('Event deleted');
            onClose();
            onDeleted?.();
          },
          onError: (err) => toast.error(err.message),
        })
      }
      loading={deleteEvent.isPending}
      tone="danger"
      icon={<Trash2 size={20} aria-hidden />}
      title="Delete this event?"
      name={event ? eventTitle(event.name, event.campus) : ''}
      body="will be permanently deleted. This cannot be undone."
      warning={
        event && event.reports > 0
          ? `${plural(event.reports, 'status report is', 'status reports are')} linked to this event and will be deleted with it.`
          : undefined
      }
      confirmLabel="Delete event"
    />
  );
}
