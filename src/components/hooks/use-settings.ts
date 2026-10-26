import {
  createSettingsItem,
  deleteSettingsItem,
  getCampus,
  getCasualtyConditions,
  getClusters,
  getDamageConditions,
  getEventStatuses,
  getPositions,
  getSettingsItems,
  getUnits,
  getUserTypes,
  SettingsTable,
  updateSettingsItem,
} from '@/actions/settings';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

/** Other lists that show a table's rows: buildings also appear on the assessment pages. */
const ALSO_SHOWN_IN: Partial<Record<SettingsTable, string[]>> = {
  buildings: ['building-summaries', 'admin-assessments', 'assessment-setup', 'building-safety'],
};

function invalidateTable(queryClient: QueryClient, table: SettingsTable) {
  for (const key of [table, ...(ALSO_SHOWN_IN[table] ?? [])]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useSettingsTable(table: SettingsTable, filterId?: string) {
  return useQuery({
    queryKey: [table, filterId],
    queryFn: () => getSettingsItems(table, filterId),
  });
}

export function useCreateSetting(table: SettingsTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createSettingsItem(table, data),
    onSuccess: () => invalidateTable(queryClient, table),
  });
}

export function useUpdateSetting(table: SettingsTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateSettingsItem(table, id, data),
    onSuccess: () => invalidateTable(queryClient, table),
  });
}

export function useDeleteSetting(table: SettingsTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSettingsItem(table, id),
    onSuccess: () => invalidateTable(queryClient, table),
  });
}

// Individual Settings Item
export function useUnits(clusterId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['units', clusterId],
    queryFn: () => getUnits(clusterId),
    enabled: options?.enabled ?? true,
  });
}

export function useCampus(campusId?: string) {
  return useQuery({
    queryKey: ['campus', campusId],
    queryFn: getCampus,
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
