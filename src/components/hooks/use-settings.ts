import {
  createSettingsItem,
  deleteSettingsItem,
  getCasualtyConditions,
  getClusters,
  getDamageConditions,
  getEventStatuses,
  getLocations,
  getPositions,
  getSettingsItems,
  getUnits,
  getUserTypes,
  SettingsTable,
  updateSettingsItem,
} from '@/actions/settings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useSettingsTable(table: SettingsTable) {
  return useQuery({
    queryKey: [table],
    queryFn: () => getSettingsItems(table),
  });
}

export function useCreateSetting(table: SettingsTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createSettingsItem(table, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

export function useUpdateSetting(table: SettingsTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateSettingsItem(table, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

export function useDeleteSetting(table: SettingsTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSettingsItem(table, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

// Individual Settings Item
export function useUnits(clusterId?: string) {
  return useQuery({
    queryKey: ['units', clusterId],
    queryFn: () => getUnits(clusterId),
  });
}

export function useCasualtyConditions() {
  return useQuery({
    queryKey: ['casualty_conditions'],
    queryFn: getCasualtyConditions,
  });
}

export function useClusters() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
  });
}

export function useLocations(clusterId?: string) {
  return useQuery({
    queryKey: ['locations', clusterId],
    queryFn: () => getLocations(clusterId),
  });
}

export function useUserTypes() {
  return useQuery({
    queryKey: ['user_types'],
    queryFn: getUserTypes,
  });
}

export function useEventStatuses() {
  return useQuery({
    queryKey: ['event_statuses'],
    queryFn: getEventStatuses,
  });
}

export function useDamageConditions() {
  return useQuery({
    queryKey: ['damage_conditions'],
    queryFn: getDamageConditions,
  });
}
