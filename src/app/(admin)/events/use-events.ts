import {
  createEvent,
  deleteEvent,
  getEvent,
  getEvents,
  getOngoingEvents,
  updateEvent,
} from '@/actions/events';
import type { EventFormData } from '@/lib';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useEvents(query?: string) {
  return useQuery({
    queryKey: ['events', query],
    queryFn: () => getEvents(query),
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
    mutationFn: (data: EventFormData) => createEvent(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EventFormData }) => updateEvent(id, data),
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

export function useOngoingEvents() {
  return useQuery({
    queryKey: ['events', 'ongoing'],
    queryFn: getOngoingEvents,
    staleTime: 1000 * 60 * 2,
  });
}
