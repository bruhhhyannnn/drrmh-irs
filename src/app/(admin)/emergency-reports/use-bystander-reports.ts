import {
  createBystanderReport,
  deleteBystanderReport,
  getBystanderIncidentTypes,
  getBystanderPhotoUrls,
  getBystanderReports,
  updateBystanderReportStatus,
} from '@/actions/emergency-reports';
import { BystanderReportFormData } from '@/lib';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function useCreateBystanderReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BystanderReportFormData) => createBystanderReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
      toast.success('Report submitted successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useBystanderReports(query?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bystander-reports', query],
    queryFn: () => getBystanderReports(),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateBystanderReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'reviewed' | 'verified' | 'dismissed' }) =>
      updateBystanderReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBystanderReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBystanderReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
      toast.success('Report deleted');
    },
    onError: (err: Error) => toast.error(err.message),
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
