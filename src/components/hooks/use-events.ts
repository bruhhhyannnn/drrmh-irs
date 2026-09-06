import {
  createEvent,
  deleteEvent,
  getEvent,
  getEvents,
  getOngoingEvents,
  updateEvent,
} from '@/actions/events';
import type { Prisma } from '@prisma/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Prisma.EventCreateInput) => createEvent(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Prisma.EventUpdateInput }) =>
      updateEvent(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useOngoingEvents(campusId: string) {
  return useQuery({
    queryKey: ['events', 'ongoing-all', campusId],
    queryFn: () => getOngoingEvents(campusId),
    staleTime: 1000 * 60 * 2,
  });
}
