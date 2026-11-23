import {
  completeEvents,
  createEvents,
  deleteEvent,
  getCampusEventOptions,
  getEvent,
  getEvents,
  getEventSummarySource,
  getOngoingEventOptions,
  getOngoingEvents,
  getSiblingOngoingEvents,
  updateEvent,
} from '@/actions/events';
import type { EventWriteInput } from '@/lib/schemas';
import { getAccessToken } from '@/lib/supabase';
import { okOrThrow } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

/** Everything that shows an event's name, status, dates or counts. */
function invalidateEventViews(queryClient: QueryClient) {
  for (const key of [
    'events',
    'event',
    'event-summary',
    'event-siblings',
    'event-compare-options',
    'dashboard',
    'campus-overview',
    'campuses-overview',
  ]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useEvents(query?: string, campusId?: string) {
  return useQuery({
    queryKey: ['events', query, campusId],
    queryFn: async () => getEvents(await getAccessToken(), query, campusId),
  });
}

export function useEvent(id?: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => getEvent(await getAccessToken(), id!),
    enabled: !!id,
  });
}

export function useCreateEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, campusIds }: { data: EventWriteInput; campusIds: string[] }) =>
      okOrThrow(await createEvents(await getAccessToken(), data, campusIds)).events,
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: EventWriteInput & { campus_id: string };
    }) => okOrThrow(await updateEvent(await getAccessToken(), id, data)),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

export function useCompleteEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) =>
      okOrThrow(await completeEvents(await getAccessToken(), ids)),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => okOrThrow(await deleteEvent(await getAccessToken(), id)),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

/** `refetchInterval` lets a page that is waiting for an event to start check again on its own. */
export function useOngoingEvents(campusId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['events', 'ongoing-all', campusId],
    queryFn: async () => getOngoingEvents(await getAccessToken(), campusId),
    enabled: !!campusId,
    staleTime: 1000 * 60 * 2,
    refetchInterval: options?.refetchInterval,
  });
}

export function useOngoingEventOptions(campusId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['events', 'ongoing-options', campusId],
    queryFn: async () => getOngoingEventOptions(await getAccessToken(), campusId),
    enabled: options?.enabled ?? true,
  });
}

export function useSiblingOngoingEvents(eventId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['event-siblings', eventId],
    queryFn: async () => getSiblingOngoingEvents(await getAccessToken(), eventId!),
    enabled: !!eventId && (options?.enabled ?? true),
  });
}

export function useCampusEventOptions(campusId?: string) {
  return useQuery({
    queryKey: ['event-compare-options', campusId],
    queryFn: async () => getCampusEventOptions(await getAccessToken(), campusId!),
    enabled: !!campusId,
  });
}

/** The summary source query, also fetched on demand (Export NSED report on an Events row). */
export const eventSummarySourceQuery = (eventId: string) => ({
  queryKey: ['event-summary', eventId],
  queryFn: async () => getEventSummarySource(await getAccessToken(), eventId),
});

export function useEventSummarySource(eventId?: string) {
  return useQuery({ ...eventSummarySourceQuery(eventId ?? ''), enabled: !!eventId });
}
