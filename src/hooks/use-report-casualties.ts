import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReportCasualties, upsertReportCasualty, deleteReportCasualty } from '@/actions';

export function useReportCasualties(reportId?: string) {
  return useQuery({
    queryKey: ['report-casualties', reportId],
    queryFn: () => getReportCasualties(reportId!),
    enabled: !!reportId,
  });
}

export function useUpsertReportCasualty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      report_id: string;
      condition_id: string;
      count: number;
      names?: string | null;
    }) => upsertReportCasualty(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['report-casualties', variables.report_id] });
    },
  });
}

export function useDeleteReportCasualty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; reportId: string }) => deleteReportCasualty(id),
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['report-casualties', reportId] });
    },
  });
}
