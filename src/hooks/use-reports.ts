import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReports,
  getReport,
  getReportsByEvent,
  createReport,
  updateReport,
  deleteReport,
  getReportClusterSummary,
  getReportTotals,
} from '@/actions/reports';
import type { Prisma, Report } from '@prisma/client';

export function useReports(page: number = 1, query?: string) {
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

export function useEventReports(eventId?: string) {
  return useQuery({
    queryKey: ['event-reports', eventId],
    queryFn: () => getReportsByEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Prisma.ReportCreateInput) => createReport(data),
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

export function useReportClusterSummary() {
  return useQuery({
    queryKey: ['report-cluster-summary'],
    queryFn: () => getReportClusterSummary(),
  });
}

export function useTotalAffected(report: Report): number {
  return (
    (report.faculty_members ?? 0) +
    (report.admin_members ?? 0) +
    (report.reps_members ?? 0) +
    (report.ra_members ?? 0) +
    (report.students ?? 0) +
    (report.philcare_staff ?? 0) +
    (report.security_personnel ?? 0) +
    (report.construction_workers ?? 0) +
    (report.tenants ?? 0) +
    (report.health_workers ?? 0) +
    (report.non_academic_staff ?? 0) +
    (report.guests ?? 0)
  );
}

export function useReportTotals() {
  return useQuery({
    queryKey: ['report-totals'],
    queryFn: () => getReportTotals(),
  });
}
