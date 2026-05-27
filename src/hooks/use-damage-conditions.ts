import { getDamageConditions } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useDamageConditions() {
  return useQuery({
    queryKey: ['damage_reports'],
    queryFn: getDamageConditions,
  });
}
