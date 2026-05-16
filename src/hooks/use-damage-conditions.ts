import { useQuery } from '@tanstack/react-query';
import { getDamageConditions } from '@/actions';

export function useDamageConditions() {
  return useQuery({
    queryKey: ['damage_reports'],
    queryFn: getDamageConditions,
  });
}
