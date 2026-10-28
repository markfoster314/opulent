import type {
  Card,
  CardChoices,
  CardGroup,
  CardPriceSeries,
  CardSet,
  Page,
  PriceRange,
} from '@opulent/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';

export function useGroups(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => api<{ items: CardGroup[] }>('/v1/groups'),
    enabled,
  });
}

export function useCardPriceSeries(scryfallId: string | undefined, range: PriceRange) {
  const api = useApi();
  return useQuery({
    queryKey: ['cards', 'price-series', scryfallId ?? 'none', range] as const,
    queryFn: () =>
      api<CardPriceSeries>(
        `/v1/cards/${encodeURIComponent(scryfallId ?? '')}/prices?range=${encodeURIComponent(range)}`,
      ),
    enabled: Boolean(scryfallId),
  });
}

export function useCard(scryfallId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.card(scryfallId ?? ''),
    queryFn: () => api<Card>(`/v1/cards/${encodeURIComponent(scryfallId ?? '')}`),
    enabled: Boolean(scryfallId),
  });
}

export function useCardSearch(term: string) {
  const api = useApi();
  // Normalize case and spacing so each meaningful term gets one cache entry.
  const query = term.trim().replace(/\s+/g, ' ').toLowerCase();
  return useQuery({
    queryKey: queryKeys.cardSearch(query),
    queryFn: () =>
      api<{ items: Card[] }>(`/v1/cards/search?q=${encodeURIComponent(query)}&uniqueByOracle=true`),
    // Two characters is the shortest term worth a request.
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useCardSets(oracleId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.cardSets(oracleId ?? 'none'),
    queryFn: () =>
      api<{ items: CardSet[] }>(`/v1/cards/oracle/${encodeURIComponent(oracleId ?? '')}/sets`),
    enabled: Boolean(oracleId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Server-side set filter matters for cards like Plains with 900+ printings; only one page is held. */
export function useCardPrintings(
  oracleId: string | undefined,
  setFilter = '',
  limit = 8,
  cursor: string | null = null,
) {
  const api = useApi();
  const term = setFilter.trim();
  return useQuery({
    queryKey: [...queryKeys.cardPrintings(oracleId ?? 'none', term), 'page', limit, cursor ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (term) params.set('q', term);
      if (cursor) params.set('cursor', cursor);
      return api<Page<Card>>(
        `/v1/cards/oracle/${encodeURIComponent(oracleId ?? '')}/printings?${params.toString()}`,
      );
    },
    enabled: Boolean(oracleId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCardLanguages(scryfallId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.cardLanguages(scryfallId ?? 'none'),
    queryFn: () =>
      api<{ items: Card[] }>(`/v1/cards/${encodeURIComponent(scryfallId ?? '')}/languages`),
    enabled: Boolean(scryfallId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetSearch(term: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.setSearch(term),
    queryFn: () => api<{ items: CardSet[] }>(`/v1/cards/sets?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOracleChoices(oracleId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.cardChoices(oracleId ?? 'none'),
    queryFn: () =>
      api<CardChoices>(`/v1/cards/oracle/${encodeURIComponent(oracleId ?? '')}/choices`),
    enabled: Boolean(oracleId),
    staleTime: 5 * 60 * 1000,
  });
}
