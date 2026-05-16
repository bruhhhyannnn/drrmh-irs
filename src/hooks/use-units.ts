import { useQuery } from '@tanstack/react-query';
import { getUnits } from '@/actions';

export function useUnits(clusterId?: string) {
  return useQuery({
    queryKey: ['units', clusterId],
    queryFn: () => getUnits(clusterId),
  });
}
