import {
  createAssessment,
  getAssessmentSetup,
  getMyAssessment,
  getMyAssessments,
  getPublishedTemplate,
  getTemplateVersion,
} from '@/actions/assessments';
import { toPayload, type AssessmentDraft } from '@/lib/assessment-draft';
import type { AssessmentTemplate } from '@/lib/assessment-template';
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

/**
 * Offline: the cached copy. Online: a fresh copy, which then replaces the cached one. A request
 * that can't reach the server falls back to the cached copy too.
 */
async function withOfflineCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = () => getAssessmentCache<T>(key).catch(() => undefined);
  if (!navigator.onLine) {
    const value = await cached();
    if (value !== undefined) return value;
    throw new Error("This isn't saved on this phone yet. Connect to the internet once to get it.");
  }
  try {
    const value = await fetcher();
    await putAssessmentCache(key, value).catch(() => {});
    return value;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const value = await cached();
    if (value !== undefined) return value;
    throw err;
  }
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
  });
}

export function useMyAssessment(id?: string) {
  return useQuery({
    queryKey: ['my-assessment', id],
    queryFn: async () => getMyAssessment(await getAccessToken(), id!),
    enabled: !!id,
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
        result = await createAssessment(await getAccessToken(), payload);
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
