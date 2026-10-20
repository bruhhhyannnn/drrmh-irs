import { getDashboard } from '@/actions/dashboard';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';

/** The dashboard for one campus (or all), with this month in the admin's own time zone. */
export function useDashboard(campusId?: string) {
  const now = new Date();
  const monthKey = format(now, 'yyyy-MM');
  return useQuery({
    queryKey: ['dashboard', campusId, monthKey],
    queryFn: () => getDashboard(campusId, startOfMonth(now), endOfMonth(now)),
    refetchInterval: 1000 * 60,
  });
}
