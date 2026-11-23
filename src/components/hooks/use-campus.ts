import {
  createCampus,
  deleteCampus,
  getCampusClusters,
  getCampuses,
  getCampusesOverview,
  getCampusLogos,
  getCampusOverview,
  setCampusLogo,
  updateCampus,
} from '@/actions/campus-table';
import { getAccessToken } from '@/lib/supabase';
import { okOrThrow } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

function invalidateCampusViews(queryClient: QueryClient) {
  for (const key of [
    'campuses',
    'campus',
    'campuses-overview',
    'campus-overview',
    'campus-logos',
  ]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useCampuses(query?: string) {
  return useQuery({
    queryKey: ['campuses', query],
    queryFn: () => getCampuses(),
  });
}

export function useCampusesOverview({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['campuses-overview'],
    queryFn: async () => getCampusesOverview(await getAccessToken()),
    enabled,
  });
}

export function useCampusOverview(id?: string) {
  return useQuery({
    queryKey: ['campus-overview', id],
    queryFn: async () => getCampusOverview(await getAccessToken(), id!),
    enabled: !!id,
  });
}

export function useCreateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; is_active?: boolean }) =>
      okOrThrow(await createCampus(await getAccessToken(), data)).campus,
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}

export function useUpdateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; is_active?: boolean };
    }) => okOrThrow(await updateCampus(await getAccessToken(), id, data)).campus,
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}

export function useDeleteCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => okOrThrow(await deleteCampus(await getAccessToken(), id)),
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}

export function useCampusClusters(campusId: string) {
  return useQuery({
    queryKey: ['cluster', campusId],
    queryFn: () => getCampusClusters(campusId),
    enabled: !!campusId,
  });
}

/**
 * Uploaded campus logos (DRRM-036), by campus id and by name. Rarely change, so they are
 * cached for 10 minutes; Add / Edit campus refreshes them.
 */
export function useCampusLogos() {
  return useQuery({
    queryKey: ['campus-logos'],
    queryFn: () => getCampusLogos(),
    staleTime: 10 * 60_000,
  });
}

/** Sets (a scaled PNG or WebP) or removes (`logo: null`) a campus's uploaded logo. */
export function useSetCampusLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campusId, logo }: { campusId: string; logo: Blob | null }) => {
      let form: FormData | null = null;
      if (logo) {
        form = new FormData();
        form.append('logo', logo, logo.type === 'image/webp' ? 'logo.webp' : 'logo.png');
      }
      const result = await setCampusLogo(await getAccessToken(), campusId, form);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateCampusViews(queryClient),
  });
}
