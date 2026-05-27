import { getActivityLogs } from '@/actions';
import { useQuery } from '@tanstack/react-query';

/* ─── Activity Logs ──────────────────────────────────────── */
export function useActivityLogs(page: number = 1, query?: string) {
  return useQuery({
    queryKey: ['activity-logs', page, query],
    queryFn: () => getActivityLogs(page, query),
  });
}
