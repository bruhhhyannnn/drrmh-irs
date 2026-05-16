import { useQuery } from '@tanstack/react-query';
import { getEventStatuses } from '@/actions';

export function useEventStatuses() {
  return useQuery({
    queryKey: ['event_statuses'],
    queryFn: getEventStatuses,
  });
}
