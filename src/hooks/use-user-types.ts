import { useQuery } from '@tanstack/react-query';
import { getUserTypes } from '@/actions';

export function useUserTypes() {
  return useQuery({
    queryKey: ['user_types'],
    queryFn: getUserTypes,
  });
}
