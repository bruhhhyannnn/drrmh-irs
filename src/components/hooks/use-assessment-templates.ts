import {
  createDraftVersion,
  deleteDraftVersion,
  deleteItem,
  deleteSection,
  getTemplateVersions,
  publishVersion,
  reorderItem,
  reorderSection,
  updateItemWording,
  updateSectionTitle,
  upsertAreaType,
  upsertItem,
  upsertSection,
} from '@/actions/assessment-templates';
import { getPublishedTemplate } from '@/actions/assessments';
import type { TemplateActionResult } from '@/lib/assessment-template';
import { putAssessmentCache } from '@/lib/offline-queue';
import type {
  AreaTypeFormData,
  DraftVersionFormData,
  ItemFormData,
  ItemWordingFormData,
  SectionFormData,
  SectionWordingFormData,
} from '@/lib/schemas';
import { getAccessToken } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Super Admin checklist editor hooks (DRRM-015 Phase 3). Every mutation invalidates the editor,
// the ERT and admin assessment queries, and refreshes the local published-template cache.

export function useChecklistEditor(versionId?: string | null) {
  return useQuery({
    queryKey: ['checklist-editor', versionId || null],
    queryFn: async () => getTemplateVersions(await getAccessToken(), versionId || null),
  });
}

function useChecklistMutation<TArgs>(
  run: (token: string | null, args: TArgs) => Promise<TemplateActionResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const result = await run(await getAccessToken(), args);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: async () => {
      for (const key of [
        'checklist-editor',
        'assessment-template',
        'assessment-template-version',
        'admin-assessment',
        'my-assessment',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      const published = await getPublishedTemplate().catch(() => null);
      if (published) {
        await putAssessmentCache('template:published', published).catch(() => {});
        await putAssessmentCache(`template:${published.version_id}`, published).catch(() => {});
      }
    },
  });
}

export function useUpdateSectionTitle() {
  return useChecklistMutation((token, { id, data }: { id: string; data: SectionWordingFormData }) =>
    updateSectionTitle(token, id, data)
  );
}

export function useUpdateItemWording() {
  return useChecklistMutation((token, { id, data }: { id: string; data: ItemWordingFormData }) =>
    updateItemWording(token, id, data)
  );
}

export function useCreateDraftVersion() {
  return useChecklistMutation((token, data: DraftVersionFormData) =>
    createDraftVersion(token, data)
  );
}

export function usePublishVersion() {
  return useChecklistMutation((token, versionId: string) => publishVersion(token, versionId));
}

export function useDeleteDraftVersion() {
  return useChecklistMutation((token, versionId: string) => deleteDraftVersion(token, versionId));
}

export function useUpsertSection() {
  return useChecklistMutation(
    (token, input: SectionFormData & { version_id: string; id?: string }) =>
      upsertSection(token, input)
  );
}

export function useDeleteSection() {
  return useChecklistMutation((token, sectionId: string) => deleteSection(token, sectionId));
}

export function useReorderSection() {
  return useChecklistMutation(
    (token, { id, direction }: { id: string; direction: 'up' | 'down' }) =>
      reorderSection(token, id, direction)
  );
}

export function useUpsertItem() {
  return useChecklistMutation((token, input: ItemFormData & { section_id: string; id?: string }) =>
    upsertItem(token, input)
  );
}

export function useDeleteItem() {
  return useChecklistMutation((token, itemId: string) => deleteItem(token, itemId));
}

export function useReorderItem() {
  return useChecklistMutation(
    (token, { id, direction }: { id: string; direction: 'up' | 'down' }) =>
      reorderItem(token, id, direction)
  );
}

export function useUpsertAreaType() {
  return useChecklistMutation((token, input: AreaTypeFormData & { id?: string }) =>
    upsertAreaType(token, input)
  );
}
