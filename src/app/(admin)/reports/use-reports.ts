import {
  createReport,
  createReportCasualty,
  createReportMissingPerson,
  deleteReport,
  deleteReportCasualty,
  deleteReportMissingPerson,
  getReport,
  getReportCasualties,
  getReportClusterSummary,
  getReportMissingPersons,
  getReports,
  getReportsByEvent,
  getReportTotals,
  updateReport,
} from '@/actions/reports';
import { CasualtyFormData, MissingPersonFormData, ReportFormData } from '@/lib';
import type { Prisma } from '@prisma/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useReports(page: number, query: string) {
  return useQuery({
    queryKey: ['reports', page, query],
    queryFn: () => getReports(page, query),
  });
}

export function useReport(id?: string) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () => getReport(id!),
    enabled: !!id,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReportFormData) => createReport(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Prisma.ReportUpdateInput }) =>
      updateReport(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useEventReports(eventId?: string) {
  return useQuery({
    queryKey: ['event-reports', eventId],
    queryFn: () => getReportsByEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useReportClusterSummary() {
  return useQuery({
    queryKey: ['report-cluster-summary'],
    queryFn: () => getReportClusterSummary(),
  });
}

export function useReportTotals() {
  return useQuery({
    queryKey: ['report-totals'],
    queryFn: () => getReportTotals(),
  });
}

// Report Casualties
export function useReportCasualties(reportId?: string) {
  return useQuery({
    queryKey: ['report-casualties', reportId],
    queryFn: () => getReportCasualties(reportId!),
    enabled: !!reportId,
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
