import { getClusters } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useClusters() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  });
}
