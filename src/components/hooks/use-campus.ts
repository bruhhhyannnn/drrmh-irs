import {
  createCampus,
  deleteCampus,
  getCampus,
  getCampuses,
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

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campus'] }),
  });
}
