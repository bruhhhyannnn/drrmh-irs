import {
  deleteBystanderReport,
  getBystanderIncidentTypes,
  getBystanderPhotoUrls,
  getBystanderReports,
  getPendingBystanderCount,
  markBystanderReportSeen,
  updateBystanderReportStatus,
} from '@/actions/emergency-reports';
import { getAccessToken } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

export type BystanderStatus = 'reviewed' | 'verified' | 'dismissed';

function invalidateBystanderViews(queryClient: QueryClient) {
  for (const key of ['bystander-reports', 'bystander-pending', 'dashboard']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
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

/**
 * Opening a report marks it seen, for every admin (DRRM-042). The list updates at once, so the
 * red dot goes without waiting for a refetch.
 */
export function useMarkBystanderReportSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => markBystanderReportSeen(await getAccessToken(), id),
    onMutate: (id) => {
      queryClient.setQueriesData<{ id: string; unopened: boolean }[]>(
        { queryKey: ['bystander-reports'] },
        (list) => list?.map((r) => (r.id === id ? { ...r, unopened: false } : r))
      );
    },
  });
}
