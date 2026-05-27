import { getLocations } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useLocations(clusterId?: string) {
  return useQuery({
    queryKey: ['locations', clusterId],
    queryFn: () => getLocations(clusterId),
  });
}
