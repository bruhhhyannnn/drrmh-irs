import {
  createReportCasualty,
  createReportMissingPerson,
  deleteReport,
  deleteReportCasualty,
  deleteReportMissingPerson,
  getMyLatestReport,
  getMyReportForOngoingEvent,
  getReport,
  getReportCasualties,
  getReportMissingPersons,
  getReportPhotoUrls,
  getReports,
  saveReportEdits,
  type ReportEditData,
  type ReportListFilters,
} from '@/actions/reports';
import { CasualtyFormData, MissingPersonFormData, toReportPhotoFormData } from '@/lib';
import { getAccessToken } from '@/lib/supabase';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useReports(
  page: number,
  query: string,
  campusId?: string,
  filters: ReportListFilters = {}
) {
  return useQuery({
    queryKey: ['reports', page, query, campusId, filters.eventId, filters.clusterId],
    queryFn: () => getReports(page, query, campusId, filters),
    placeholderData: keepPreviousData,
  });
}

export function useReport(id?: string) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const result = await getReport(await getAccessToken(), id!);
      if (!result.ok) throw new Error(result.error);
      return result.report;
    },
    enabled: !!id,
  });
}

export function useSaveReportEdits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReportEditData }) => {
      const result = await saveReportEdits(await getAccessToken(), id, data);
      if (!result.ok) throw new Error(result.error);
      return result.report;
    },
    onSuccess: (_data, { id }) => {
      for (const key of ['reports', 'event-summary', 'dashboard']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['report-casualties', id] });
      queryClient.invalidateQueries({ queryKey: ['report-missing-persons', id] });
      queryClient.invalidateQueries({ queryKey: ['report-photo-urls', id] });
    },
  });
}

/**
 * Signed links to a report's photos, for admins; fetched when the report is opened. A failure
 * is thrown, not kept as data, so reopening the report or focusing the window asks again.
 */
export function useReportPhotoUrls(reportId: string | undefined, hasPhotos: boolean) {
  return useQuery({
    queryKey: ['report-photo-urls', reportId],
    queryFn: async () => {
      const result = await getReportPhotoUrls(await getAccessToken(), reportId!);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    enabled: !!reportId && hasPhotos,
    // The links last an hour.
    staleTime: 1000 * 60 * 50,
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteReport(await getAccessToken(), id);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      for (const key of ['reports', 'event-summary', 'dashboard', 'events']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useMyReport(userId?: string) {
  return useQuery({
    queryKey: ['my-report', userId],
    queryFn: () => getMyReportForOngoingEvent(userId!),
    enabled: !!userId,
  });
}

export function useMyLatestReport(userId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-latest-report', userId],
    queryFn: () => getMyLatestReport(userId!),
    enabled: !!userId && (options?.enabled ?? true),
  });
}

// Report Casualties
export function useReportCasualties(reportId?: string) {
  return useQuery({
    queryKey: ['report-casualties', reportId],
    queryFn: async () => {
      const result = await getReportCasualties(await getAccessToken(), reportId!);
      if (!result.ok) throw new Error(result.error);
      return result.casualties;
    },
    enabled: !!reportId,
    staleTime: Infinity,
  });
}

export function useCreateReportCasualty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      photos,
      ...data
    }: CasualtyFormData & { report_id: string; photos?: Blob[] }) => {
      const result = await createReportCasualty(
        await getAccessToken(),
        data,
        toReportPhotoFormData(photos)
      );
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['report-casualties', variables.report_id] });
      queryClient.invalidateQueries({ queryKey: ['report-photo-urls', variables.report_id] });
    },
  });
}

export function useDeleteReportCasualty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; reportId: string }) => {
      const result = await deleteReportCasualty(await getAccessToken(), id);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['report-casualties', reportId] });
      queryClient.invalidateQueries({ queryKey: ['report-photo-urls', reportId] });
    },
  });
}

// Report Missing Persons
export function useReportMissingPersons(reportId?: string) {
  return useQuery({
    queryKey: ['report-missing-persons', reportId],
    queryFn: () => getReportMissingPersons(reportId!),
    enabled: !!reportId,
    staleTime: Infinity,
  });
}

export function useCreateReportMissingPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: MissingPersonFormData & { report_id: string }) => {
      const result = await createReportMissingPerson(await getAccessToken(), data);
      if (!result.ok) throw new Error(result.error);
      return result.missingPerson;
    },
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
    mutationFn: async ({ id }: { id: string; reportId: string }) => {
      const result = await deleteReportMissingPerson(await getAccessToken(), id);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['report-missing-persons', reportId] });
    },
  });
}
