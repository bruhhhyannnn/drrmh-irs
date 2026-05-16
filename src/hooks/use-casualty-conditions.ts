import { useQuery } from '@tanstack/react-query';
import { getCasualtyConditions } from '@/actions';

export function useCasualtyConditions() {
  return useQuery({
    queryKey: ['casualty_conditions'],
    queryFn: getCasualtyConditions,
  });
}
