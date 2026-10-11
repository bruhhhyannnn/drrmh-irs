import {
  createCampus,
  deleteCampus,
  getCampus,
  getCampusClusters,
  getCampuses,
  getCampusesOverview,
  getCampusOverview,
  updateCampus,
} from '@/actions/campus-table';
import type { Prisma } from '@prisma/client';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

function invalidateCampusViews(queryClient: QueryClient) {
  for (const key of ['campuses', 'campus', 'campuses-overview', 'campus-overview']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useCampuses(query?: string) {
  return useQuery({
    queryKey: ['campuses', query],
    queryFn: () => getCampuses(),
  });
}

export function useCampus(id?: string) {
  return useQuery({
    queryKey: ['campus', id],
    queryFn: () => getCampus(id!),
    enabled: !!id,
  });
}

export function useCampusesOverview() {
  return useQuery({
    queryKey: ['campuses-overview'],
    queryFn: getCampusesOverview,
  });
}

export function useCampusOverview(id?: string) {
  return useQuery({
    queryKey: ['campus-overview', id],
    queryFn: () => getCampusOverview(id!),
    enabled: !!id,
  });
}

export function useCreateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Prisma.campusCreateInput) => createCampus(data),
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}

export function useUpdateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Prisma.campusUpdateInput }) =>
      updateCampus(id, data),
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}

export function useDeleteCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampus(id),
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}

export function useCampusClusters(campusId: string) {
  return useQuery({
    queryKey: ['cluster', campusId],
    queryFn: () => getCampusClusters(campusId),
    enabled: !!campusId,
  });
}
