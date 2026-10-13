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
  getReports,
  saveReportEdits,
  type ReportEditData,
  type ReportListFilters,
} from '@/actions/reports';
import { CasualtyFormData, MissingPersonFormData } from '@/lib';
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
    queryFn: () => getReport(id!),
    enabled: !!id,
  });
}

export function useSaveReportEdits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReportEditData }) => saveReportEdits(id, data),
    onSuccess: (_data, { id }) => {
      for (const key of ['reports', 'event-summary', 'dashboard']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['report-casualties', id] });
      queryClient.invalidateQueries({ queryKey: ['report-missing-persons', id] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
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
    queryFn: () => getReportCasualties(reportId!),
    enabled: !!reportId,
    staleTime: Infinity,
  });
}

export function useCreateReportCasualty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CasualtyFormData & { report_id: string }) => createReportCasualty(data),
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
    mutationFn: (data: MissingPersonFormData & { report_id: string }) =>
      createReportMissingPerson(data),
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
