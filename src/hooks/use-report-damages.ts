import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReportDamages, toggleReportDamage, deleteReportDamage } from '@/actions';

export function useReportDamages(reportId?: string) {
  return useQuery({
    queryKey: ['report-damages', reportId],
    queryFn: () => getReportDamages(reportId!),
    enabled: !!reportId,
  });
}

export function useToggleReportDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { report_id: string; damage_condition_id: string }) =>
      toggleReportDamage(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['report-damages', variables.report_id] });
    },
  });
}

export function useDeleteReportDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; reportId: string }) => deleteReportDamage(id),
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['report-damages', reportId] });
    },
  });
}
