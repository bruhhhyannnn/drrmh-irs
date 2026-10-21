import {
  deleteAssessment,
  getAssessment,
  getAssessmentList,
  getBuildingSummaries,
} from '@/actions/assessment-admin';
import {
  createAssessment,
  getAssessmentSetup,
  getMyAssessment,
  getMyAssessments,
  getPublishedTemplate,
  getTemplateVersion,
} from '@/actions/assessments';
import { compareAssessments, getBuildingHistory, getSafetyRollup } from '@/actions/building-safety';
import { toPayload, type AssessmentDraft } from '@/lib/assessment-draft';
import type { AssessmentTemplate } from '@/lib/assessment-template';
import { cachedFetch, withTimeout } from '@/lib/offline-cache';
import {
  deleteAssessmentDraft,
  getAllQueuedCount,
  getAssessmentCache,
  getAssessmentDrafts,
  isNetworkError,
  putAssessmentCache,
  queueAssessment,
} from '@/lib/offline-queue';
import { getAccessToken } from '@/lib/supabase';
import { useOfflineQueueStore } from '@/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// The building assessment, for the ERT pages. The checklist and form setup are cached in
// IndexedDB so the form opens offline; drafts live only on the phone; a submit made offline (or
// cut off) goes to the offline queue, which OfflineQueueProvider sends when the connection is back.

/** How long to wait for the server before using the copy saved on this phone (weak signal). */
const SLOW_NETWORK_MS = 6_000;
/** How long a submit may take before it goes to the offline queue instead (client_ref dedupes
 * a submit that did land in the meantime). */
const SUBMIT_TIMEOUT_MS = 20_000;

/** The copy saved on this phone when offline or slow, else a fresh one (see cachedFetch). */
function withOfflineCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  return cachedFetch({
    online: navigator.onLine,
    read: () => getAssessmentCache<T>(key),
    write: (value) => putAssessmentCache(key, value),
    fetch: fetcher,
    slowMs: SLOW_NETWORK_MS,
  });
}

/** The published checklist. Also cached by version, for drafts started on it. */
export function useAssessmentTemplate() {
  return useQuery({
    queryKey: ['assessment-template'],
    queryFn: () =>
      withOfflineCache('template:published', async () => {
        const template = await getPublishedTemplate();
        if (template) {
          await putAssessmentCache(`template:${template.version_id}`, template).catch(() => {});
        }
        return template;
      }),
    networkMode: 'always',
  });
}

/** A checklist version by id: the one a draft or a submitted assessment was answered with. */
export function useTemplateVersion(versionId?: string) {
  return useQuery({
    queryKey: ['assessment-template-version', versionId],
    queryFn: () => withOfflineCache(`template:${versionId}`, () => getTemplateVersion(versionId!)),
    enabled: !!versionId,
    networkMode: 'always',
  });
}

/** Clusters, units, buildings and recent events of the campus, for the Details step. */
export function useAssessmentSetup(campusId?: string) {
  return useQuery({
    queryKey: ['assessment-setup', campusId],
    queryFn: () => withOfflineCache(`setup:${campusId}`, () => getAssessmentSetup(campusId!)),
    enabled: !!campusId,
    networkMode: 'always',
  });
}

/** This user's drafts on this phone, last edited first. */
export function useAssessmentDrafts(evaluatorId?: string) {
  return useQuery({
    queryKey: ['assessment-drafts', evaluatorId],
    queryFn: async () =>
      (await getAssessmentDrafts())
        .filter((d) => d.evaluator_id === evaluatorId)
        .sort((a, b) => b.updated_at - a.updated_at),
    enabled: !!evaluatorId,
    networkMode: 'always',
  });
}

/** `userId` only keys the cache per account; the server goes by the access token. */
export function useMyAssessments(userId?: string) {
  return useQuery({
    queryKey: ['my-assessments', userId],
    queryFn: async () => getMyAssessments(await getAccessToken()),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useMyAssessment(id?: string) {
  return useQuery({
    queryKey: ['my-assessment', id],
    queryFn: async () => getMyAssessment(await getAccessToken(), id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

const QUEUED_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

type SubmitResult = { status: 'sent'; id: string } | { status: 'queued' };

/** Sends the draft, or keeps it in the offline queue when it can't go now. Either way the draft
 * is then removed; a refusal that retrying won't fix throws and leaves the draft as it is. */
export function useSubmitAssessment() {
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineQueueStore((s) => s.setPendingCount);

  return useMutation({
    mutationFn: async ({
      template,
      draft,
    }: {
      template: AssessmentTemplate;
      draft: AssessmentDraft;
    }): Promise<SubmitResult> => {
      const payload = toPayload(template, draft, new Date());
      const removeDraft = () => deleteAssessmentDraft(draft.client_ref).catch(() => {});
      const queue = async (): Promise<SubmitResult> => {
        await queueAssessment(payload, undefined, {
          title: draft.building_name || draft.new_building_name.trim() || 'Building assessment',
          subtitle: `Assessment · ${QUEUED_DATE.format(new Date())}`,
        });
        await removeDraft();
        return { status: 'queued' };
      };

      if (!navigator.onLine) return queue();
      let result;
      try {
        result = await withTimeout(
          createAssessment(await getAccessToken(), payload),
          SUBMIT_TIMEOUT_MS
        );
      } catch (err) {
        if (isNetworkError(err)) return queue();
        throw err;
      }
      if (!result.ok) {
        if (result.retry) return queue();
        throw new Error(result.error);
      }
      await removeDraft();
      return { status: 'sent', id: result.id };
    },
    networkMode: 'always',
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['my-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-setup'] });
      setPendingCount(await getAllQueuedCount().catch(() => 0));
    },
  });
}

/* ─── Admin pages (Phase 2): campusId from useScopedCampusId(), '' meaning all campuses ─── */

export function useAssessmentList(campusId?: string) {
  return useQuery({
    queryKey: ['admin-assessments', campusId || null],
    queryFn: async () => getAssessmentList(await getAccessToken(), campusId || null),
    staleTime: 60_000,
  });
}

export function useBuildingSummaries(campusId?: string) {
  return useQuery({
    queryKey: ['building-summaries', campusId || null],
    queryFn: async () => getBuildingSummaries(await getAccessToken(), campusId || null),
    staleTime: 60_000,
  });
}

export function useAdminAssessment(id?: string) {
  return useQuery({
    queryKey: ['admin-assessment', id],
    queryFn: async () => getAssessment(await getAccessToken(), id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteAssessment(await getAccessToken(), id);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      for (const key of [
        'admin-assessments',
        'building-summaries',
        'building-safety',
        'building-history',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/* ─── Dashboard Building safety ─── */

/** One drill-down level; campusId null leaves the campus to the server (an Administrator's own). */
export function useSafetyRollup(
  scope: { campusId: string | null; clusterId: string | null; unitId: string | null },
  enabled = true
) {
  return useQuery({
    queryKey: ['building-safety', scope.campusId, scope.clusterId, scope.unitId],
    queryFn: async () => getSafetyRollup(await getAccessToken(), scope),
    enabled,
    staleTime: 60_000,
  });
}

export function useBuildingHistory(buildingId?: string | null) {
  return useQuery({
    queryKey: ['building-history', buildingId],
    queryFn: async () => getBuildingHistory(await getAccessToken(), buildingId!),
    enabled: !!buildingId,
    staleTime: 60_000,
  });
}

export function useCompareAssessments(aId?: string | null, bId?: string | null) {
  return useQuery({
    queryKey: ['assessment-compare', aId, bId],
    queryFn: async () => compareAssessments(await getAccessToken(), aId!, bId!),
    enabled: !!aId && !!bId && aId !== bId,
    staleTime: 60_000,
  });
}
