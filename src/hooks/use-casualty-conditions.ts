import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCasualtyConditions,
  // getCasualtyCondition,
  createCasualtyCondition,
  updateCasualtyCondition,
  deleteCasualtyCondition,
} from '@/actions';

export function useCasualtyConditions() {
  return useQuery({
    queryKey: ['casualty_conditions'],
    queryFn: getCasualtyConditions,
  });
}

export function useCreateCasualtyCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; is_active?: boolean }) => createCasualtyCondition(data.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['casualty_conditions'] }),
  });
}

export function useUpdateCasualtyCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; is_active?: boolean } }) =>
      updateCasualtyCondition(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['casualty_conditions'] });
      queryClient.invalidateQueries({ queryKey: ['casualty_condition', id] });
    },
  });
}

export function useDeleteCasualtyCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCasualtyCondition(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['casualty_conditions'] }),
  });
}
