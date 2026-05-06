import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CLUSTERS } from '@/types';

type HeadcountRow = {
  students: number | null;
  faculty_members: number | null;
  admin_members: number | null;
  reps_members: number | null;
  ra_members: number | null;
  philcare_staff: number | null;
  security_personnel: number | null;
  construction_workers: number | null;
  tenants: number | null;
  health_workers: number | null;
  non_academic_staff: number | null;
  guests: number | null;
};

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

      console.log(reportsRes);
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

interface ClusterStat {
  cluster: string;
  reports: number;
  affected: number;
  pct: number;
}

export function useClusterStats() {
  return useQuery({
    queryKey: ['landing-cluster-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(
          'cluster:clusters(name), students, faculty_members, admin_members, reps_members, ra_members, philcare_staff, security_personnel, construction_workers, tenants, health_workers, non_academic_staff, guests'
        )
        .limit(500);

      if (error) throw error;

      const clusterMap: Record<string, { count: number; affected: number }> = {};
      for (const cluster of CLUSTERS) {
        clusterMap[cluster] = { count: 0, affected: 0 };
      }

      let maxReports = 0;
      for (const r of data ?? []) {
        const key = (r.cluster as any)?.name ?? '';
        if (!key) continue;
        if (!clusterMap[key]) clusterMap[key] = { count: 0, affected: 0 };
        clusterMap[key].count += 1;
        clusterMap[key].affected += totalAffected(r as HeadcountRow);
        if (clusterMap[key].count > maxReports) maxReports = clusterMap[key].count;
      }

      const stats: ClusterStat[] = CLUSTERS.map((c) => ({
        cluster: c,
        reports: clusterMap[c]?.count ?? 0,
        affected: clusterMap[c]?.affected ?? 0,
        pct: maxReports > 0 ? Math.round(((clusterMap[c]?.count ?? 0) / maxReports) * 100) : 0,
      }));

      return stats;
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

function totalAffected(r: HeadcountRow): number {
  return (
    (r.students ?? 0) +
    (r.faculty_members ?? 0) +
    (r.admin_members ?? 0) +
    (r.reps_members ?? 0) +
    (r.ra_members ?? 0) +
    (r.philcare_staff ?? 0) +
    (r.security_personnel ?? 0) +
    (r.construction_workers ?? 0) +
    (r.tenants ?? 0) +
    (r.health_workers ?? 0) +
    (r.non_academic_staff ?? 0) +
    (r.guests ?? 0)
  );
}
