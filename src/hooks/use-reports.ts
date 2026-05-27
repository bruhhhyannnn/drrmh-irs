import {
  createReport,
  deleteReport,
  getReport,
  getReportClusterSummary,
  getReports,
  getReportsByEvent,
  getReportTotals,
  updateReport,
  verifyReport,
} from '@/actions';
import type { Prisma } from '@prisma/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useReports(page: number, query: string, isVerified: boolean) {
  return useQuery({
    queryKey: ['reports', page, query, isVerified],
    queryFn: () => getReports(page, query, isVerified),
  });
}

export function useVerifyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reportId,
      approved,
      adminId,
    }: {
      reportId: string;
      approved: boolean;
      adminId: string;
    }) => verifyReport(reportId, approved, adminId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'], exact: false });
    },
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

export function useReportTotals() {
  return useQuery({
    queryKey: ['report-totals'],
    queryFn: () => getReportTotals(),
  });
}
