import {
  createReportMissingPerson,
  deleteReportMissingPerson,
  getReportMissingPersons,
} from '@/actions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useReportMissingPersons(reportId?: string) {
  return useQuery({
    queryKey: ['report-missing-persons', reportId],
    queryFn: () => getReportMissingPersons(reportId!),
    enabled: !!reportId,
  });
}

export function useCreateReportMissingPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { report_id: string; name: string }) => createReportMissingPerson(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['report-missing-persons', variables.report_id],
      });
    },
  });
}

export function useDeleteReportMissingPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; reportId: string }) => deleteReportMissingPerson(id),
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['report-missing-persons', reportId] });
    },
  });
}
