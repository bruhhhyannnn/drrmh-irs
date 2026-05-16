import { useQuery } from '@tanstack/react-query';
import { getLocations } from '@/actions';

export function useLocations(clusterId?: string) {
  return useQuery({
    queryKey: ['locations', clusterId],
    queryFn: () => getLocations(clusterId),
  });
}
