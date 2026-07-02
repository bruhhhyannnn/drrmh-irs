import {
  createCampus,
  deleteCampus,
  getCampus,
  getCampusClusters,
  getCampuses,
  getCampusEvents,
  getCampusHeadcountPerEvent,
  updateCampus,
} from '@/actions/campus-table';
import type { Prisma } from '@prisma/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useCampuses(query?: string) {
  return useQuery({
    queryKey: ['campuses', query],
    queryFn: () => getCampuses(query),
  });
}

export function useCampus(id?: string) {
  return useQuery({
    queryKey: ['campus', id],
    queryFn: () => getCampus(id!),
    enabled: !!id,
  });
}

export function useCreateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Prisma.campusCreateInput) => createCampus(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campus'] }),
  });
}

export function useUpdateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Prisma.campusUpdateInput }) =>
      updateCampus(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['campus', id] });
    },
  });
}

export function useDeleteCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campus'] }),
  });
}

export function useCampusEvents(query?: string) {
  return useQuery({
    queryKey: ['campuses', query],
    queryFn: () => getCampusEvents(query),
  });
}

export function useCampusClusters(campusId: string) {
  return useQuery({
    queryKey: ['cluster', campusId],
    queryFn: () => getCampusClusters(campusId),
    enabled: !!campusId,
  });
}

export function useCampusHeadcountPerEvent(eventId: string, campusId: string) {
  return useQuery({
    queryKey: ['campusHeadcount', eventId, campusId],
    queryFn: () => getCampusHeadcountPerEvent(eventId, campusId),
    enabled: !!eventId && !!campusId,
  });
}
