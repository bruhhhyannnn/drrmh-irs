'use client';

import {
  createMatatagForm,
  getMatatagAssessment,
  getMatatagAssessments,
  getMatatagAssignableUsers,
  getMatatagCampuses,
  getMatatagDashboard,
  getMatatagForm,
  getMatatagForms,
  getMatatagTemplate,
  publishCampusMatatagTemplate,
  publishMatatagTemplate,
  reopenMatatagResponse,
  saveMatatagAssessment,
  updateMatatagForm,
} from '@/actions/matatag';
import { MatatagDocument } from '@/lib/matatag';
import type { MatatagTemplate } from '@/lib/matatag-template';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to save and access shared assessments.');
  return data.session.access_token;
}
function unwrap<T>(result: { data?: T; error?: string }): T {
  if (result.error || result.data === undefined)
    throw new Error(result.error || 'Unable to load assessment.');
  return result.data;
}
export function useMatatagTemplate() {
  return useQuery({
    queryKey: ['matatag-template'],
    queryFn: async () => unwrap(await getMatatagTemplate()),
  });
}
export function usePublishMatatagTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { revision: number; definition: MatatagTemplate }) =>
      unwrap(await publishMatatagTemplate(await token(), input)),
    onSuccess: (data) => client.setQueryData(['matatag-template'], data),
  });
}
export function useMatatagCampuses() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-campuses', user?.id],
    enabled: !!user,
    queryFn: async () => unwrap(await getMatatagCampuses(await token())),
  });
}
export function useMatatagRecords(page = 1, query = '', formId?: string, generalOnly = false) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-records', user?.id, page, query, formId, generalOnly],
    enabled: !!user,
    queryFn: async () =>
      unwrap(await getMatatagAssessments(await token(), page, query, formId, generalOnly)),
  });
}
export function useMatatagDashboard() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-dashboard', user?.id],
    enabled: !!user,
    queryFn: async () => unwrap(await getMatatagDashboard(await token())),
  });
}
export function useMatatagRecord(id: string | null, formId?: string) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-record', user?.id, id, formId],
    enabled: !!user && !!id,
    queryFn: async () => unwrap(await getMatatagAssessment(await token(), id!, formId)),
  });
}
export function useMatatagAssignableUsers(campusId: string) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-assignable-users', user?.id, campusId],
    enabled: !!user && !!campusId,
    queryFn: async () => unwrap(await getMatatagAssignableUsers(await token(), campusId)),
  });
}
export function useSaveMatatag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      complete: boolean;
      document: MatatagDocument;
      formId?: string;
    }) => unwrap(await saveMatatagAssessment(await token(), input)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['matatag-records'] });
      void client.invalidateQueries({ queryKey: ['matatag-record'] });
      void client.invalidateQueries({ queryKey: ['matatag-forms'] });
    },
  });
}

export function useMatatagForms(page = 1, query = '') {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-forms', user?.id, page, query],
    enabled: !!user,
    queryFn: async () => unwrap(await getMatatagForms(await token(), page, query)),
  });
}
export function useMatatagForm(id: string | null) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['matatag-form', user?.id, id],
    enabled: !!user && !!id,
    queryFn: async () => unwrap(await getMatatagForm(await token(), id!)),
  });
}
export function useCreateMatatagForm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      campusId: string;
      phase?: 'PRE' | 'POST';
      accessMode?: 'CAMPUS' | 'ASSIGNED';
      userIds?: string[];
    }) => unwrap(await createMatatagForm(await token(), input)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['matatag-forms'] });
    },
  });
}
export function useUpdateMatatagForm(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version: number;
      title: string;
      isOpen: boolean;
      phase?: 'PRE' | 'POST';
      accessMode?: 'CAMPUS' | 'ASSIGNED';
      userIds?: string[];
    }) => unwrap(await updateMatatagForm(await token(), id, input)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['matatag-forms'] });
      void client.invalidateQueries({ queryKey: ['matatag-form'] });
    },
  });
}
export function usePublishCampusMatatag(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { revision: number; definition: MatatagTemplate }) =>
      unwrap(await publishCampusMatatagTemplate(await token(), id, input)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['matatag-form'] });
      void client.invalidateQueries({ queryKey: ['matatag-forms'] });
    },
  });
}
export function useReopenMatatagResponse(formId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) =>
      unwrap(await reopenMatatagResponse(await token(), formId, input.id, input.version)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['matatag-records'] });
      void client.invalidateQueries({ queryKey: ['matatag-record'] });
    },
  });
}
