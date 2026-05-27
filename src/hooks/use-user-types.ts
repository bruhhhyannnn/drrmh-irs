import { getUserTypes } from '@/actions';
import { useQuery } from '@tanstack/react-query';

export function useUserTypes() {
  return useQuery({
    queryKey: ['user_types'],
    queryFn: getUserTypes,
  });
}
