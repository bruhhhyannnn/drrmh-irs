import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/* ── Aggregate stats ──────────────────────────────────────── */
export function useLandingStats() {
  return useQuery({
    queryKey: ['landing-stats'],
    queryFn: async () => {
      const [eventsRes, reportsRes, usersRes, allEventsRes] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        // Fetch with status join to filter ongoing events client-side
        supabase.from('events').select('id, status:event_statuses(name)'),
      ]);

      const activeEvents = (allEventsRes.data ?? []).filter(
        (e: any) => e.status?.name === 'ongoing'
      ).length;

      return {
        totalEvents: eventsRes.count ?? 0,
        totalReports: reportsRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        activeEvents,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Cluster breakdown from reports ──────────────────────── */

export function useClusterStats() {
  return useQuery({
    queryKey: ['landing-cluster-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('reports').select('clusters(name)');

      if (error) throw error;

      const clusterMap: Record<string, number> = {};

      for (const row of data ?? []) {
        const key = (row.clusters as unknown as { name: string } | null)?.name ?? '';
        if (!key) continue;
        clusterMap[key] = (clusterMap[key] ?? 0) + 1;
      }

      const max = Math.max(...Object.values(clusterMap), 1);

      return Object.entries(clusterMap).map(([cluster, count]) => ({
        cluster,
        reports: count,
        pct: Math.round((count / max) * 100),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Recent events for the hero preview ─────────────────── */
export function useLandingEvents() {
  return useQuery({
    queryKey: ['landing-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, started_at, status:event_statuses(name), location:locations(name)')
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        name: string;
        started_at: string | null;
        status: { name: string } | null;
        location: { name: string } | null;
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
