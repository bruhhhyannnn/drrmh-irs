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
import type { Prisma } from '@prisma/client';
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
    queryFn: () => getEvents(query, campusId),
  });
}

export function useEvent(id?: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id!),
    enabled: !!id,
  });
}

export function useCreateEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      campusIds,
    }: {
      data: Omit<Prisma.EventUncheckedCreateInput, 'campus_id'>;
      campusIds: string[];
    }) => createEvents(data, campusIds),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Prisma.EventUpdateInput }) =>
      updateEvent(id, data),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

export function useCompleteEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, userId }: { ids: string[]; userId: string | null }) =>
      completeEvents(ids, userId),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => invalidateEventViews(queryClient),
  });
}

/** `refetchInterval` lets a page that is waiting for an event to start check again on its own. */
export function useOngoingEvents(campusId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['events', 'ongoing-all', campusId],
    queryFn: () => getOngoingEvents(campusId),
    enabled: !!campusId,
    staleTime: 1000 * 60 * 2,
    refetchInterval: options?.refetchInterval,
  });
}

export function useOngoingEventOptions(campusId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['events', 'ongoing-options', campusId],
    queryFn: () => getOngoingEventOptions(campusId),
    enabled: options?.enabled ?? true,
  });
}

export function useSiblingOngoingEvents(eventId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['event-siblings', eventId],
    queryFn: () => getSiblingOngoingEvents(eventId!),
    enabled: !!eventId && (options?.enabled ?? true),
  });
}

export function useCampusEventOptions(campusId?: string) {
  return useQuery({
    queryKey: ['event-compare-options', campusId],
    queryFn: () => getCampusEventOptions(campusId!),
    enabled: !!campusId,
  });
}

export function useEventSummarySource(eventId?: string) {
  return useQuery({
    queryKey: ['event-summary', eventId],
    queryFn: () => getEventSummarySource(eventId!),
    enabled: !!eventId,
  });
}
