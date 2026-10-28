import type {
  AddCollectionItemInput,
  AddFriendInput,
  AddWantItemInput,
  CardGroup,
  CardChoices,
  CardPriceSeries,
  CardSet,
  CollectionHighlight,
  CollectionImportInput,
  CollectionImportResult,
  CollectionSummary,
  CollectionValueBreakdown,
  CollectionValueBreakdownBy,
  CollectionValueHistory,
  MatchOwner,
  TradeBinder,
  CreateGenericWantInput,
  CreateWantListInput,
  Friend,
  GenericMatchOwner,
  GenericWant,
  WantList,
  WantsImportInput,
  WantsImportResult,
  CollectionItem,
  Card,
  CompleteOnboardingInput,
  CreateCardGroupInput,
  UsernameAvailability,
  Me,
  Profile,
  PlaceRef,
  Page,
  PriceRange,
  TradeMatch,
  TradeChoices,
  TradeDetail,
  TradeSummary,
  CreateTradeInput,
  TradeLinesInput,
  UpdateCardGroupInput,
  SplitCollectionItemInput,
  UpdateCollectionItemInput,
  UpdateProfileInput,
  UpdateWantItemInput,
  UpdateWantListInput,
  WantItem,
} from '@opulent/shared';
import { useAuth0 } from '@auth0/auth0-react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { binderSearchParams, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { useDebounced } from '../hooks/useDebounced';
import { useApi } from './ApiProvider';

/** Centralized query keys keep cache invalidation reliable. */
export const queryKeys = {
  me: ['me'] as const,
  friends: ['friends'] as const,
  followers: (username: string) => ['followers', username] as const,
  following: (username: string) => ['following', username] as const,
  collection: ['collection'] as const,
  collectionItems: ['collection', 'items'] as const,
  collectionSummary: ['collection', 'summary'] as const,
  tradeBinder: (handle: string) => ['trade-binder', handle] as const,
  tradeBinderItems: (handle: string) => ['trade-binder', handle, 'items'] as const,
  tradeBinderMatches: (handle: string) => ['trade-binder', handle, 'matches'] as const,
  matchOwners: ['matches'] as const,
  allWantItems: ['wants', 'all', 'items'] as const,
  publicWantItems: (handle: string) => ['wants', 'public', handle, 'items'] as const,
  profile: (username: string) => ['profile', username] as const,
  usernameAvailability: (username: string) => ['username-available', username] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  groupItems: (id: string) => ['group', id, 'items'] as const,
  wants: ['wants'] as const,
  genericWants: ['wants', 'generic'] as const,
  genericMatches: ['wants', 'generic', 'matches'] as const,
  setSearch: (term: string) => ['cards', 'sets', 'search', term] as const,
  wantList: (id: string) => ['wants', id] as const,
  wantItems: (id: string) => ['wants', id, 'items'] as const,
  cardChoices: (oracleId: string) => ['cards', 'choices', oracleId] as const,
  cardSearch: (term: string) => ['cards', 'search', term] as const,
  placeSearch: (term: string) => ['places', 'search', term] as const,
  cardPrintings: (oracleId: string, setFilter: string) =>
    ['cards', 'printings', oracleId, setFilter] as const,
  cardSets: (oracleId: string) => ['cards', 'sets', oracleId] as const,
  cardLanguages: (scryfallId: string) => ['cards', 'languages', scryfallId] as const,
  card: (scryfallId: string) => ['cards', scryfallId] as const,
  sharedWantList: (handle: string, slug: string) => ['wants', 'by', handle, slug] as const,
  sharedWantItems: (handle: string, slug: string) =>
    ['wants', 'by', handle, slug, 'items'] as const,
  trades: ['trades'] as const,
  trade: (id: string) => ['trades', id] as const,
  tradeChoices: (id: string) => ['trades', id, 'choices'] as const,
};

export function useMe(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<Me>('/v1/users/me'),
    enabled,
  });
}

/** Typing-time hint only; the server decides whether the username is free. */
export function useUsernameAvailability(username: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.usernameAvailability(username),
    queryFn: () =>
      api<UsernameAvailability>(
        `/v1/users/me/username-available?username=${encodeURIComponent(username)}`,
      ),
    enabled: enabled && username.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useCompleteOnboarding() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) =>
      api<Me>('/v1/users/me/onboarding', { method: 'POST', body: input }),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}

/** Changing a username moves share links, so cached profiles are dropped too. */
export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<Me>('/v1/users/me', { method: 'PATCH', body: input }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me, me);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useProfile(username: string | undefined) {
  const api = useApi();
  const { isAuthenticated } = useAuth0();
  const me = useMe(isAuthenticated);
  const viewer = isAuthenticated ? (me.data?.id ?? 'signed-in') : 'guest';
  return useQuery({
    queryKey: [...queryKeys.profile(username ?? ''), viewer],
    queryFn: () => api<Profile>(`/v1/users/${username}`),
    enabled: Boolean(username) && (!isAuthenticated || me.isFetched),
  });
}

export function useFollowers(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.followers(username ?? ''),
    queryFn: () => api<{ items: Friend[] }>(`/v1/users/${username}/followers`),
    enabled: Boolean(username),
  });
}

export function useFollowing(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.following(username ?? ''),
    queryFn: () => api<{ items: Friend[] }>(`/v1/users/${username}/following`),
    enabled: Boolean(username),
  });
}

export function useAddFriend() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddFriendInput) =>
      api<Friend>('/v1/users/me/friends', { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      void queryClient.invalidateQueries({ queryKey: ['followers'] });
      void queryClient.invalidateQueries({ queryKey: ['following'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useRemoveFriend() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) =>
      api<void>(`/v1/users/me/friends/${username}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      void queryClient.invalidateQueries({ queryKey: ['followers'] });
      void queryClient.invalidateQueries({ queryKey: ['following'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/** Balances a full grid against a slow first load. */
const BINDER_PAGE_SIZE = 24;

function useDebouncedSearch(search: BinderSearch): BinderSearch {
  const q = useDebounced(search.q);
  const set = useDebounced(search.set);
  const type = useDebounced(search.type);
  const artist = useDebounced(search.artist);
  return { ...search, q, set, type, artist };
}

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

export function useCardPriceSeries(scryfallId: string | undefined, range: PriceRange) {
  const api = useApi();
  return useQuery({
    queryKey: ['cards', 'price-series', scryfallId ?? 'none', range] as const,
    queryFn: () => api<CardPriceSeries>(`/v1/cards/${scryfallId}/prices?range=${range}`),
    enabled: Boolean(scryfallId),
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
function refreshStacks(queryClient: ReturnType<typeof useQueryClient>) {
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

export function useGroups(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => api<{ items: CardGroup[] }>('/v1/groups'),
    enabled,
  });
}

export function useGroup(groupId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.group(groupId ?? 'none'),
    queryFn: () => api<CardGroup>(`/v1/groups/${groupId}`),
    enabled: Boolean(groupId),
  });
}

export function useCreateGroup() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardGroupInput) =>
      api<CardGroup>('/v1/groups', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
  });
}

export function useUpdateGroup(groupId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCardGroupInput) =>
      api<CardGroup>(`/v1/groups/${groupId}`, { method: 'PATCH', body: input }),
    onSuccess: (group) => {
      queryClient.setQueryData(queryKeys.group(groupId), group);
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    },
  });
}

export function useDeleteGroup() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api<void>(`/v1/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      void queryClient.invalidateQueries({ queryKey: ['group'] });
    },
  });
}

/** Adds a group label; the card stays in the collection. */
export function useAddGroupMember(groupId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: boolean }>(`/v1/groups/${groupId}/items/${itemId}`, { method: 'POST' }),
    onSuccess: () => refreshStacks(queryClient),
  });
}

export function useRemoveGroupMember(groupId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<void>(`/v1/groups/${groupId}/items/${itemId}`, { method: 'DELETE' }),
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

/** Preview uses the same body as the commit. */
export function useImportWants() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WantsImportInput) =>
      api<WantsImportResult>('/v1/wants/import', { method: 'POST', body: input }),
    onSuccess: (result) => {
      if (result.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: ['wants'] });
    },
  });
}

/** Returns want CSV text; the caller hands it to the browser as a file. */
export function useExportWants(listId?: string) {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api<string>(listId ? `/v1/wants/lists/${listId}/export.csv` : '/v1/wants/export.csv', {
        asText: true,
      }),
  });
}

export function useTradeBinder(handle: string | undefined, shareToken?: string) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.tradeBinder(handle ?? ''), shareToken ?? ''],
    queryFn: () => api<TradeBinder>(`/v1/users/${handle}/trade-binder${tokenQuery(shareToken)}`),
    enabled: Boolean(handle),
  });
}

export function useTradeBinderItems(
  handle: string | undefined,
  search: BinderSearch = emptyBinderSearch,
  shareToken?: string,
) {
  const api = useApi();
  const filters = useDebouncedSearch(search);
  return useInfiniteQuery({
    queryKey: [...queryKeys.tradeBinderItems(handle ?? ''), shareToken ?? '', filters],
    queryFn: ({ pageParam }) => {
      const params = binderSearchParams(filters, pageParam, BINDER_PAGE_SIZE);
      if (shareToken) params.set('t', shareToken);
      return api<Page<CollectionItem>>(
        `/v1/users/${handle}/trade-binder/items?${params.toString()}`,
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled: Boolean(handle),
  });
}

export function useTradeBinderMatches(
  handle: string | undefined,
  enabled: boolean,
  shareToken?: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.tradeBinderMatches(handle ?? ''), shareToken ?? ''],
    queryFn: () =>
      api<{ items: TradeMatch[] }>(
        `/v1/users/${handle}/trade-binder/matches${tokenQuery(shareToken)}`,
      ),
    enabled: Boolean(handle) && enabled,
  });
}

export function useRotateTradeBinderToken() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ shareToken: string }>('/v1/users/me/trade-binder/share-token/rotate', {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useMatchOwners(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.matchOwners,
    queryFn: () => api<{ items: MatchOwner[] }>('/v1/matches'),
    enabled,
  });
}

function tokenQuery(shareToken: string | undefined): string {
  return shareToken ? `?t=${encodeURIComponent(shareToken)}` : '';
}

export function flattenPages<T>(pages: { items: T[] }[] | undefined): T[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

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

export function useCard(scryfallId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.card(scryfallId ?? ''),
    queryFn: () => api<Card>(`/v1/cards/${scryfallId}`),
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
    queryFn: () => api<{ items: CardSet[] }>(`/v1/cards/oracle/${oracleId}/sets`),
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
      return api<Page<Card>>(`/v1/cards/oracle/${oracleId}/printings?${params.toString()}`);
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
    queryFn: () => api<{ items: Card[] }>(`/v1/cards/${scryfallId}/languages`),
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

export function useGenericWants(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.genericWants,
    queryFn: () => api<{ items: GenericWant[] }>('/v1/wants/generic'),
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

export function useCreateGenericWant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGenericWantInput) =>
      api<GenericWant>('/v1/wants/generic', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.genericWants }),
  });
}

export function useDeleteGenericWant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wantId: string) => api<void>(`/v1/wants/generic/${wantId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.genericWants }),
  });
}

export function useWantLists(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.wants,
    queryFn: () => api<{ items: WantList[] }>('/v1/wants/lists'),
    enabled,
  });
}

export function useWantList(listId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.wantList(listId ?? 'none'),
    queryFn: () => api<WantList>(`/v1/wants/lists/${listId}`),
    enabled: Boolean(listId),
  });
}

export function useWantItems(listId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.wantItems(listId ?? 'none'),
    queryFn: () => api<{ items: WantItem[] }>(`/v1/wants/lists/${listId}/items`),
    enabled: Boolean(listId),
  });
}

export function useAllWantItems(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.allWantItems,
    queryFn: () => api<{ items: WantItem[] }>('/v1/wants/mine/items'),
    enabled,
  });
}

export function usePublicWantItems(handle: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.publicWantItems(handle ?? ''),
    queryFn: () => api<{ items: WantItem[] }>(`/v1/wants/by/${handle}/public-items`),
    enabled: Boolean(handle),
  });
}

export function useSharedWantList(
  handle: string | undefined,
  slug: string | undefined,
  shareToken?: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.sharedWantList(handle ?? '', slug ?? ''),
    queryFn: () =>
      api<WantList>(`/v1/wants/by/${handle}/${slug}`, {
        ...(shareToken ? { shareToken } : {}),
      }),
    enabled: Boolean(handle && slug),
  });
}

export function useSharedWantItems(
  handle: string | undefined,
  slug: string | undefined,
  shareToken?: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.sharedWantItems(handle ?? '', slug ?? ''),
    queryFn: () =>
      api<{ items: WantItem[] }>(`/v1/wants/by/${handle}/${slug}/items`, {
        ...(shareToken ? { shareToken } : {}),
      }),
    enabled: Boolean(handle && slug),
  });
}

export function useUpdateWantList(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWantListInput) =>
      api<WantList>(`/v1/wants/lists/${listId}`, { method: 'PATCH', body: input }),
    onSuccess: (list) => {
      queryClient.setQueryData(queryKeys.wantList(listId), list);
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
    },
  });
}

export function useRotateWantShareToken(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ shareToken: string }>(`/v1/wants/lists/${listId}/share-token/rotate`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) }),
  });
}

export function useCreateWantList() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWantListInput) =>
      api<WantList>('/v1/wants/lists', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wants }),
  });
}

export function useDeleteWantList() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => api<void>(`/v1/wants/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wants }),
  });
}

export function useOracleChoices(oracleId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.cardChoices(oracleId ?? 'none'),
    queryFn: () => api<CardChoices>(`/v1/cards/oracle/${oracleId}/choices`),
    enabled: Boolean(oracleId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddGlobalWant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddWantItemInput) =>
      api<WantItem>('/v1/wants/items', { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
    },
  });
}

export function useUpdateWantItem(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wantId, input }: { wantId: string; input: UpdateWantItemInput }) =>
      api<WantItem>(`/v1/wants/items/${wantId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      if (listId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.wantItems(listId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) });
      }
    },
  });
}

export function useDeleteWantItem() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wantId: string) => api<void>(`/v1/wants/items/${wantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: ['wants'] });
    },
  });
}

export function useRemoveWantItem(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    // Removing from a list leaves the want in All wants.
    mutationFn: (wantId: string) =>
      api<void>(`/v1/wants/lists/${listId}/items/${wantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wantItems(listId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) });
    },
  });
}

function refreshTrades(queryClient: ReturnType<typeof useQueryClient>, tradeId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.trades });
  if (tradeId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trade(tradeId) });
  }
}

export function useTrades(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.trades,
    queryFn: () => api<{ items: TradeSummary[] }>('/v1/trades'),
    enabled,
  });
}

export function useTrade(tradeId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.trade(tradeId ?? ''),
    queryFn: () => api<TradeDetail>(`/v1/trades/${tradeId}`),
    enabled: Boolean(tradeId),
  });
}

export function useTradeChoices(tradeId: string | undefined, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.tradeChoices(tradeId ?? ''),
    queryFn: () => api<TradeChoices>(`/v1/trades/${tradeId}/choices`),
    enabled: Boolean(tradeId) && enabled,
  });
}

export function useOpenTrade() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTradeInput) =>
      api<TradeDetail>('/v1/trades', { method: 'POST', body: input }),
    onSuccess: (trade) => refreshTrades(queryClient, trade.id),
  });
}

export function useProposeTrade(tradeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TradeLinesInput) =>
      api<TradeDetail>(`/v1/trades/${tradeId}/propose`, { method: 'POST', body: input }),
    onSuccess: () => refreshTrades(queryClient, tradeId),
  });
}

export function useFinalizeTrade(tradeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TradeLinesInput) =>
      api<TradeDetail>(`/v1/trades/${tradeId}/finalize`, { method: 'POST', body: input }),
    onSuccess: () => refreshTrades(queryClient, tradeId),
  });
}

export function useCancelTrade(tradeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<TradeDetail>(`/v1/trades/${tradeId}/cancel`, { method: 'POST' }),
    onSuccess: () => refreshTrades(queryClient, tradeId),
  });
}
