import { getPillarMetrics, getPillarOverview } from '@/actions/pillars';
import { getAccessToken } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

// The DRRM pillar pages. `campusId` is the switcher's choice; '' means all campuses.

export function usePillarMetrics(slug: string, campusId: string) {
  return useQuery({
    queryKey: ['pillar-metrics', slug, campusId],
    queryFn: async () => getPillarMetrics(await getAccessToken(), slug, campusId || null),
    staleTime: 60_000,
  });
}

export function usePillarOverview(campusId: string) {
  return useQuery({
    queryKey: ['pillar-overview', campusId],
    queryFn: async () => getPillarOverview(await getAccessToken(), campusId || null),
    staleTime: 60_000,
  });
}
