import { useQuery } from '@tanstack/react-query';
import { getPositions } from '@/actions';

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
  });
}
