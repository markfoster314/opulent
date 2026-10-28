import type { PlaceRef } from '@opulent/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';

/** City lookup uses our GeoNames copy; two letters is the shortest useful term. */
export function usePlaceSearch(term: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.placeSearch(term),
    queryFn: () => api<{ items: PlaceRef[] }>(`/v1/places?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
