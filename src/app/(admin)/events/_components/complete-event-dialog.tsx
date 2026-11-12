'use client';

import {
  useCompleteEvents,
  useEventSummarySource,
  useSiblingOngoingEvents,
} from '@/components/hooks/use-events';
import { useAuthStore } from '@/store';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { useIsSuperAdmin } from '../../_components/shell/campus-switcher';
import { useSummary } from '../../_components/summary/event-summary';

/** "Pharmacy has", "Pharmacy and CBEA have", "Pharmacy, CBEA and Library have". */
function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Complete event: status Completed and end time now, in one step. Names clusters with no report
 * so nobody completes too early. Super admins can complete the same event at other campuses too;
 * administrators only see their own.
 */
export function CompleteEventDialog({
  open,
  onClose,
  eventId,
  title,
  eventName,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  title: string;
  eventName: string;
}) {
  const userId = useAuthStore((s) => s.userProfile?.id ?? null);
  const { data: source } = useEventSummarySource(eventId);
  const summary = useSummary(source);
  const isSuperAdmin = useIsSuperAdmin();
  const { data: siblings = [] } = useSiblingOngoingEvents(eventId, {
    enabled: open && isSuperAdmin,
  });
  const completeEvents = useCompleteEvents();
  const [alsoOthers, setAlsoOthers] = useState(false);

  const pending = summary?.clusters.pending.map((c) => c.name) ?? [];
  const locked =
    'Once the event is completed, ERT members can no longer send or edit reports for it.';
  const ids = [eventId, ...(isSuperAdmin && alsoOthers ? siblings.map((s) => s.id) : [])];
  const otherCampuses = listNames(siblings.map((s) => s.campus.name));

  const confirm = () =>
    completeEvents.mutate(
      { ids, userId },
      {
        onSuccess: () => {
          toast.success(ids.length > 1 ? `${ids.length} events completed` : 'Event completed');
          setAlsoOthers(false);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      }
    );

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      loading={completeEvents.isPending}
      tone="success"
      icon={<Check size={20} aria-hidden />}
      title="Complete this event?"
      name={title}
      body={`will be marked Completed, with ${format(new Date(), 'h:mm a')} as its end time.`}
      warning={
        pending.length
          ? `${listNames(pending)} ${pending.length === 1 ? 'has' : 'have'} not reported yet. ${locked}`
          : locked
      }
      checkbox={
        isSuperAdmin && siblings.length
          ? {
              label: `Also complete it at ${otherCampuses}`,
              description:
                siblings.length === 1
                  ? `It is also a ${eventName} event that is still ongoing.`
                  : `${siblings.length === 2 ? 'Both' : `All ${siblings.length}`} are ${eventName} events that are still ongoing.`,
              checked: alsoOthers,
              onChange: setAlsoOthers,
            }
          : undefined
      }
      confirmVariant="primary"
      confirmLabel={ids.length > 1 ? `Complete ${ids.length} events` : 'Complete event'}
    />
  );
}
