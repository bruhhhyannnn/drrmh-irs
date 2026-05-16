import { useQuery } from '@tanstack/react-query';
import { getClusters } from '@/actions';

export function useClusters() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  });
}
