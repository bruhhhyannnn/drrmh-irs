import { getUnits } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useUnits(clusterId?: string) {
  return useQuery({
    queryKey: ['units', clusterId],
    queryFn: () => getUnits(clusterId),
  });
}
