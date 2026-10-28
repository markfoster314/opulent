import type { GenericMatchOwner, MatchOwner } from '@opulent/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';

export function useMatchOwners(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.matchOwners,
    queryFn: () => api<{ items: MatchOwner[] }>('/v1/matches'),
    enabled,
  });
}

export function useGenericMatches(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.genericMatches,
    queryFn: () => api<{ items: GenericMatchOwner[] }>('/v1/wants/generic/matches'),
    enabled,
  });
}
