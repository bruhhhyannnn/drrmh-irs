import {
  createUser,
  getUser,
  getUsers,
  toggleUserStatus,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/actions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/* ─── Users ──────────────────────────────────────────────── */
export function useUsers(query?: string) {
  return useQuery({
    queryKey: ['users', query],
    queryFn: () => getUsers(query),
  });
}

export function useUser(id?: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => createUser(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) => updateUser(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, current }: { id: string; current: boolean }) =>
      toggleUserStatus(id, current),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
