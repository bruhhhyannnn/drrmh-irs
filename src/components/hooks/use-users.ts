import {
  createUser,
  deleteUser,
  getAvatars,
  getUser,
  getUsers,
  setShowMyGooglePhoto,
  setUserActive,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/actions/users';
import { getAccessToken } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** A unit or position typed under "Other (please specify)" is new in the Settings lists. */
function invalidateNamedLookups(
  queryClient: ReturnType<typeof useQueryClient>,
  data: UpdateUserInput
) {
  if (data.custom_unit_name) queryClient.invalidateQueries({ queryKey: ['units'] });
  if (data.custom_position_name) queryClient.invalidateQueries({ queryKey: ['positions'] });
}

/* ─── Users ──────────────────────────────────────────────── */
export function useUsers(query?: string, campusId?: string) {
  return useQuery({
    queryKey: ['users', query, campusId],
    queryFn: async () => getUsers(await getAccessToken(), query, campusId),
  });
}

export function useUser(id?: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => getUser(await getAccessToken(), id!),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserInput) => createUser(data, await getAccessToken()),
    onSuccess: (_user, data) => {
      invalidateNamedLookups(queryClient, data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['campuses-overview'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserInput }) =>
      updateUser(await getAccessToken(), id, data),
    onSuccess: (_user, { id, data }) => {
      invalidateNamedLookups(queryClient, data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserActive(await getAccessToken(), id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteUser(await getAccessToken(), id),
    onSuccess: (result) => {
      if (result.ok) queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/**
 * Members' Google photos for an admin list, by user id (DRRM-039). Users who turned theirs off,
 * and accounts without one, aren't in it; the list shows their initials.
 */
export function useAvatars(userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ['avatars', ids],
    queryFn: async () => getAvatars(await getAccessToken(), ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
  });
}

/** My profile → Show my Google photo; the signed-in profile follows. */
export function useSetShowMyGooglePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (show: boolean) => {
      const result = await setShowMyGooglePhoto(await getAccessToken(), show);
      if (!result.ok) throw new Error(result.error);
      return show;
    },
    onSuccess: (show) => {
      const { userProfile, setUserProfile } = useAuthStore.getState();
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          avatar: { url: userProfile.avatar?.url ?? null, show },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
    },
  });
}
