import type {
  AddCollectionItemInput,
  CollectionHighlight,
  CollectionImportInput,
  CollectionImportResult,
  CollectionItem,
  CollectionSummary,
  CollectionValueBreakdown,
  CollectionValueBreakdownBy,
  CollectionValueHistory,
  Page,
  PriceRange,
  SplitCollectionItemInput,
  UpdateCollectionItemInput,
} from '@opulent/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';
import {
  binderSearchParams,
  emptyBinderSearch,
  type BinderSearch,
} from '@/shared/binder/binderSearch';
import { useDebouncedSearch } from '@/shared/binder/useDebouncedSearch';

export function useCollectionSummary(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.collectionSummary,
    queryFn: () => api<CollectionSummary>('/v1/collection/summary'),
    enabled,
  });
}

export function useCollectionHighlights(enabled: boolean, limit = 10) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.collection, 'highlights', limit] as const,
    queryFn: () =>
      api<{ items: CollectionHighlight[] }>(`/v1/collection/highlights?limit=${limit}`),
    enabled,
  });
}

export function useCollectionValueHistory(enabled: boolean, range: PriceRange) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.collection, 'value-history', range] as const,
    queryFn: () => api<CollectionValueHistory>(`/v1/collection/value-history?range=${range}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCollectionValueBreakdown(enabled: boolean, by: CollectionValueBreakdownBy) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.collection, 'value-breakdown', by] as const,
    queryFn: () => api<CollectionValueBreakdown>(`/v1/collection/value-breakdown?by=${by}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCollectionMovers(
  enabled: boolean,
  range: PriceRange,
  changeMode: 'amount' | 'percent',
) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.collection, 'movers', range, changeMode] as const,
    queryFn: () =>
      api<{ gainers: CollectionHighlight[]; losers: CollectionHighlight[] }>(
        `/v1/collection/movers?range=${range}&changeBy=${changeMode}&limit=5`,
      ),
    // Keep old rows visible while the next window loads so the section never collapses.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCollectionItem(itemId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.collection, 'item', itemId ?? 'none'] as const,
    queryFn: () => api<CollectionItem>(`/v1/collection/items/${itemId}`),
    enabled: Boolean(itemId),
  });
}

export function useCollectionCardsByValue(
  enabled: boolean,
  search: BinderSearch = emptyBinderSearch,
) {
  const api = useApi();
  const filters = useDebouncedSearch(search);
  return useInfiniteQuery({
    queryKey: [...queryKeys.collection, 'cardsByValue', filters] as const,
    queryFn: ({ pageParam }) =>
      api<Page<CollectionHighlight>>(
        `/v1/collection/cards?${binderSearchParams(filters, pageParam, 50).toString()}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** A stack change invalidates the collection, its groups, and group-list counts. */
export function refreshStacks(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.collection });
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
  void queryClient.invalidateQueries({ queryKey: ['group'] });
}

export function useAddCollectionItem() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddCollectionItemInput) =>
      api<CollectionItem>('/v1/collection/items', { method: 'POST', body: input }),
    onSuccess: () => refreshStacks(queryClient),
  });
}

export function useUpdateCollectionItem() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateCollectionItemInput }) =>
      api<CollectionItem>(`/v1/collection/items/${itemId}`, { method: 'PATCH', body: input }),
    onSuccess: () => refreshStacks(queryClient),
  });
}

interface CardListCache {
  pages: Page<CollectionHighlight>[];
  pageParams: unknown[];
}

/** Reuse the PATCH row in cached lists; refetch only the summary, whose counts and value change. */
export function useSetTradeFlag() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, forTrade }: { itemId: string; forTrade: boolean }) =>
      api<CollectionItem>(`/v1/collection/items/${itemId}`, {
        method: 'PATCH',
        body: { forTrade },
      }),
    onSuccess: (item) => {
      queryClient.setQueriesData<CardListCache>(
        { queryKey: [...queryKeys.collection, 'cardsByValue'] },
        (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  items: page.items.map((row) =>
                    row.id === item.id ? { ...row, forTrade: item.forTrade } : row,
                  ),
                })),
              }
            : data,
      );

      const detailKey = [...queryKeys.collection, 'item', item.id] as const;
      if (queryClient.getQueryData(detailKey)) {
        queryClient.setQueryData(detailKey, item);
      }

      // Other collection screens refetch when next opened, not now.
      void queryClient.invalidateQueries({ queryKey: queryKeys.collection, refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collectionSummary });
    },
  });
}

export function useSplitCollectionItem() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: SplitCollectionItemInput }) =>
      api<void>(`/v1/collection/items/${itemId}/split`, { method: 'POST', body: input }),
    onSuccess: () => refreshStacks(queryClient),
  });
}

export function useRemoveCollectionItem() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<void>(`/v1/collection/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => refreshStacks(queryClient),
  });
}

/** Preview uses the same body as the real import. */
export function useImportCollection() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectionImportInput) =>
      api<CollectionImportResult>('/v1/collection/import', { method: 'POST', body: input }),
    onSuccess: (result) => {
      if (!result.dryRun) refreshStacks(queryClient);
    },
  });
}

/** Returns CSV text; the caller turns it into a download. */
export function useExportCollection(groupId?: string) {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api<string>(
        groupId
          ? `/v1/collection/export.csv?groupId=${encodeURIComponent(groupId)}`
          : '/v1/collection/export.csv',
        { asText: true },
      ),
  });
}
