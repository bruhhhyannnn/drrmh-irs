import {
  createBystanderReport,
  deleteBystanderReport,
  getBystanderIncidentTypes,
  getBystanderPhotoUrls,
  getBystanderReports,
  getPendingBystanderCount,
  updateBystanderReportStatus,
} from '@/actions/emergency-reports';
import { BystanderReportFormData } from '@/lib';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export type BystanderStatus = 'reviewed' | 'verified' | 'dismissed';

function invalidateBystanderViews(queryClient: QueryClient) {
  for (const key of ['bystander-reports', 'bystander-pending', 'dashboard']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useCreateBystanderReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BystanderReportFormData) => createBystanderReport(data),
    onSuccess: () => {
      invalidateBystanderViews(queryClient);
      toast.success('Report submitted successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useBystanderReports(campusId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bystander-reports', campusId],
    queryFn: () => getBystanderReports(campusId),
    enabled: options?.enabled ?? true,
  });
}

/** Pending reports in scope, for the sidebar badge. Checks again every minute. */
export function usePendingBystanderCount(campusId?: string) {
  return useQuery({
    queryKey: ['bystander-pending', campusId],
    queryFn: () => getPendingBystanderCount(campusId),
    refetchInterval: 1000 * 60,
  });
}

export function useUpdateBystanderReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BystanderStatus }) =>
      updateBystanderReportStatus(id, status),
    onSuccess: () => invalidateBystanderViews(queryClient),
  });
}

export function useDeleteBystanderReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBystanderReport(id),
    onSuccess: () => invalidateBystanderViews(queryClient),
  });
}

// Signed URLs last an hour; refetch a little before they expire.
export function useBystanderPhotoUrls(reportId: string | undefined, hasPhotos: boolean) {
  return useQuery({
    queryKey: ['bystander-photo-urls', reportId],
    queryFn: () => getBystanderPhotoUrls(reportId!),
    enabled: !!reportId && hasPhotos,
    staleTime: 1000 * 60 * 50,
  });
}

export function useGetBystanderIncidentTypes() {
  return useQuery({
    queryKey: ['bystander-incident-types'],
    queryFn: () => getBystanderIncidentTypes(),
  });
}
