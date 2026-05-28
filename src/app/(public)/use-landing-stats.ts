import { getLandingData } from '@/actions/landing';
import { useQuery } from '@tanstack/react-query';

export function useLandingData() {
  return useQuery({
    queryKey: ['landing-data'],
    queryFn: getLandingData,
  });
}
