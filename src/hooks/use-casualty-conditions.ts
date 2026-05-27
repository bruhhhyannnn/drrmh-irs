import { getCasualtyConditions } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useCasualtyConditions() {
  return useQuery({
    queryKey: ['casualty_conditions'],
    queryFn: getCasualtyConditions,
  });
}
