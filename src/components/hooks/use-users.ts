import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
  setUserActive,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/actions/users';
import { getAccessToken } from '@/lib/supabase';
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
