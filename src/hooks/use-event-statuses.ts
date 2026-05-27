import { getEventStatuses } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useEventStatuses() {
  return useQuery({
    queryKey: ['event_statuses'],
    queryFn: getEventStatuses,
  });
}
