import {
  addCampusPopulationCategory,
  createPopulationCategory,
  deleteCampusPopulationCategory,
  getCampusPopulationCategories,
  getCampusPopulationCategoryAssignments,
  getCampusPopulationCategoryCounts,
  getPopulationCategories,
  reorderCampusPopulationCategories,
  updateCampusPopulationCategory,
  updatePopulationCategory,
} from '@/actions/population-categories';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useCampusPopulationCategories(campusId?: string) {
  return useQuery({
    queryKey: ['campus-population-categories', campusId],
    queryFn: () => getCampusPopulationCategories(campusId!),
    enabled: !!campusId,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePopulationCategories() {
  return useQuery({
    queryKey: ['population-categories'],
    queryFn: getPopulationCategories,
  });
}

export function useCreatePopulationCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPopulationCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['population-categories'] }),
  });
}

export function useUpdatePopulationCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ code: string; name: string; description: string; is_active: boolean }>;
    }) => updatePopulationCategory(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['population-categories'] }),
  });
}

export function useCampusPopulationCategoryAssignments(campusId?: string) {
  return useQuery({
    queryKey: ['campus-population-category-assignments', campusId],
    queryFn: () => getCampusPopulationCategoryAssignments(campusId!),
    enabled: !!campusId,
  });
}

export function useCampusPopulationCategoryCounts() {
  return useQuery({
    queryKey: ['campus-population-category-counts'],
    queryFn: getCampusPopulationCategoryCounts,
  });
}

export function useAddCampusPopulationCategory(campusId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => addCampusPopulationCategory(campusId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campus-population-category-assignments', campusId],
      });
      queryClient.invalidateQueries({ queryKey: ['campus-population-category-counts'] });
    },
  });
}

export function useUpdateCampusPopulationCategory(campusId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ is_required: boolean; is_active: boolean; sort_order: number }>;
    }) => updateCampusPopulationCategory(id, data),
    onSuccess: (_result, { data }) => {
      queryClient.invalidateQueries({
        queryKey: ['campus-population-category-assignments', campusId],
      });
      if ('is_active' in data) {
        queryClient.invalidateQueries({ queryKey: ['campus-population-category-counts'] });
      }
    },
  });
}

export function useDeleteCampusPopulationCategory(campusId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCampusPopulationCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campus-population-category-assignments', campusId],
      });
      queryClient.invalidateQueries({ queryKey: ['campus-population-category-counts'] });
    },
  });
}

export function useReorderCampusPopulationCategories(campusId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderCampusPopulationCategories(orderedIds),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['campus-population-category-assignments', campusId],
      }),
  });
}
