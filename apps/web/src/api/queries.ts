import type {
  AddBinderItemInput,
  AddFriendInput,
  AddWantItemInput,
  Binder,
  CardChoices,
  CardSet,
  CreateGenericWantInput,
  CreateWantListInput,
  Friend,
  GenericWant,
  WantList,
  BinderItem,
  Card,
  CompleteOnboardingInput,
  CreateBinderInput,
  UsernameAvailability,
  Me,
  Profile,
  PlaceRef,
  Page,
  TradeMatch,
  TradeChoice,
  TradeDetail,
  TradeSummary,
  CreateTradeInput,
  TradeLinesInput,
  UpdateBinderInput,
  UpdateBinderItemInput,
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

/** Query key factory. Keeping the keys in one place makes cache busting reliable. */
export const queryKeys = {
  me: ['me'] as const,
  friends: ['friends'] as const,
  followers: (username: string) => ['followers', username] as const,
  following: (username: string) => ['following', username] as const,
  allBinderItems: ['binders', 'all', 'items'] as const,
  publicBinderItems: (handle: string) => ['binders', 'public', handle, 'items'] as const,
  allWantItems: ['wants', 'all', 'items'] as const,
  publicWantItems: (handle: string) => ['wants', 'public', handle, 'items'] as const,
  profile: (username: string) => ['profile', username] as const,
  usernameAvailability: (username: string) => ['username-available', username] as const,
  binders: ['binders'] as const,
  binder: (id: string) => ['binder', id] as const,
  binderItems: (id: string) => ['binder', id, 'items'] as const,
  binderMatches: (id: string) => ['binder', id, 'matches'] as const,
  wants: ['wants'] as const,
  genericWants: ['wants', 'generic'] as const,
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
  sharedBinder: (handle: string, slug: string) => ['binder', 'by', handle, slug] as const,
  sharedWantList: (handle: string, slug: string) => ['wants', 'by', handle, slug] as const,
  sharedWantItems: (handle: string, slug: string) =>
    ['wants', 'by', handle, slug, 'items'] as const,
  trades: ['trades'] as const,
  trade: (id: string) => ['trades', id] as const,
  tradeChoices: (id: string) => ['trades', id, 'choices'] as const,
};

/** Resolves a public or unlisted share URL into the binder it points at. */
export function useSharedBinder(
  handle: string | undefined,
  slug: string | undefined,
  shareToken?: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.sharedBinder(handle ?? '', slug ?? ''),
    queryFn: () =>
      api<Binder>(`/v1/binders/by/${handle}/${slug}`, {
        ...(shareToken ? { shareToken } : {}),
      }),
    enabled: Boolean(handle && slug),
  });
}

export function useMe(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<Me>('/v1/users/me'),
    enabled,
  });
}

/**
 * Asks whether a username is free while the user types.
 *
 * The answer can go stale between the check and the save, so the welcome form
 * treats it as a hint. The server decides.
 */
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

/** The one-time welcome screen save. */
export function useCompleteOnboarding() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) =>
      api<Me>('/v1/users/me/onboarding', { method: 'POST', body: input }),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}

/**
 * Later edits from profile settings. Changing the username moves every share
 * link the user has handed out, so every cached binder is dropped too.
 */
export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<Me>('/v1/users/me', { method: 'PATCH', body: input }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me, me);
      queryClient.invalidateQueries({ queryKey: queryKeys.binders });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useBinders(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.binders,
    queryFn: () => api<{ items: Binder[] }>('/v1/binders'),
    enabled,
  });
}

export function useBinder(binderId: string | undefined, shareToken?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.binder(binderId ?? 'none'),
    queryFn: () =>
      api<Binder>(`/v1/binders/${binderId}`, { ...(shareToken ? { shareToken } : {}) }),
    enabled: Boolean(binderId),
  });
}

/** A page size that fills a few rows of the card grid without a long first load. */
const BINDER_PAGE_SIZE = 24;

/**
 * Keyset pagination over a binder's cards.
 *
 * The server hands back an opaque `nextCursor` rather than a page number, so
 * adding a card mid-scroll cannot duplicate or skip a row.
 */
function useDebouncedSearch(search: BinderSearch): BinderSearch {
  const q = useDebounced(search.q);
  const set = useDebounced(search.set);
  return { ...search, q, set };
}

export function useBinderItems(
  binderId: string | undefined,
  shareToken?: string,
  search: BinderSearch = emptyBinderSearch,
) {
  const api = useApi();
  const filters = useDebouncedSearch(search);
  return useInfiniteQuery({
    queryKey: [...queryKeys.binderItems(binderId ?? 'none'), filters],
    queryFn: ({ pageParam }) =>
      api<Page<BinderItem>>(
        `/v1/binders/${binderId}/items?${binderSearchParams(filters, pageParam, BINDER_PAGE_SIZE).toString()}`,
        { ...(shareToken ? { shareToken } : {}) },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled: Boolean(binderId),
  });
}

function binderItemPage(api: ReturnType<typeof useApi>, path: string, pageParam: string | null) {
  const params = new URLSearchParams({ limit: String(BINDER_PAGE_SIZE) });
  if (pageParam) params.set('cursor', pageParam);
  return api<Page<BinderItem>>(`${path}?${params.toString()}`);
}

/** Every card across the signed-in person's binders. */
export function useAllBinderItems(enabled: boolean) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.allBinderItems,
    queryFn: ({ pageParam }) => binderItemPage(api, '/v1/binders/mine/items', pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

/** Every card in this person's public binders. */
export function usePublicBinderItems(
  handle: string | undefined,
  search: BinderSearch = emptyBinderSearch,
) {
  const api = useApi();
  const filters = useDebouncedSearch(search);
  return useInfiniteQuery({
    queryKey: [...queryKeys.publicBinderItems(handle ?? ''), filters],
    queryFn: ({ pageParam }) =>
      api<Page<BinderItem>>(
        `/v1/binders/by/${handle}/public-items?${binderSearchParams(filters, pageParam, BINDER_PAGE_SIZE).toString()}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    enabled: Boolean(handle),
  });
}

/** Flattens the paged result into the single list the card grid wants. */
export function flattenPages<T>(pages: { items: T[] }[] | undefined): T[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

/** The headline feature: what the signed-in viewer wants from this binder. */
export function useBinderMatches(binderId: string | undefined, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.binderMatches(binderId ?? 'none'),
    queryFn: () => api<{ items: TradeMatch[] }>(`/v1/binders/${binderId}/matches`),
    enabled: Boolean(binderId) && enabled,
  });
}

/** Cities from our GeoNames copy. Two letters is the shortest term worth a round trip. */
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
  return useQuery({
    queryKey: queryKeys.cardSearch(term),
    queryFn: () =>
      api<{ items: Card[] }>(`/v1/cards/search?q=${encodeURIComponent(term)}&uniqueByOracle=true`),
    // Two characters is the shortest term worth a round trip.
    enabled: term.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

/** Enough tiles to fill the picker a few rows deep without a slow first paint. */
const PRINTINGS_PAGE_SIZE = 24;

/** Every set this card was printed in, for the set dropdown. */
export function useCardSets(oracleId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.cardSets(oracleId ?? 'none'),
    queryFn: () => api<{ items: CardSet[] }>(`/v1/cards/oracle/${oracleId}/sets`),
    enabled: Boolean(oracleId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Every set a card was printed in, for the printing picker.
 *
 * `setFilter` matters for cards like Plains, which has over 900 printings. It is
 * sent to the server rather than filtered here, because only a fraction of the
 * printings have been fetched at any moment.
 */
export function useCardPrintings(oracleId: string | undefined, setFilter = '') {
  const api = useApi();
  const term = setFilter.trim();
  return useInfiniteQuery({
    queryKey: queryKeys.cardPrintings(oracleId ?? 'none', term),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PRINTINGS_PAGE_SIZE) });
      if (term) params.set('q', term);
      if (pageParam) params.set('cursor', pageParam);
      return api<Page<Card>>(`/v1/cards/oracle/${oracleId}/printings?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(oracleId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Languages this printing was produced in, for the language dropdown. */
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

/** Every want across the signed-in person's lists. */
export function useAllWantItems(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.allWantItems,
    queryFn: () => api<{ items: WantItem[] }>('/v1/wants/mine/items'),
    enabled,
  });
}

/** Every want in this person's public lists. */
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
      queryClient.invalidateQueries({ queryKey: queryKeys.wants });
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

export function useCreateBinder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBinderInput) =>
      api<Binder>('/v1/binders', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.binders }),
  });
}

export function useAddBinderItem(binderId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddBinderItemInput) =>
      api<BinderItem>(`/v1/binders/${binderId}/items`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.binderItems(binderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.binders });
    },
  });
}

export function useUpdateBinderItem(binderId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateBinderItemInput }) =>
      api<BinderItem>(`/v1/binders/${binderId}/items/${itemId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.binderItems(binderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.binders });
    },
  });
}

export function useRemoveBinderItem(binderId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<void>(`/v1/binders/${binderId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.binderItems(binderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.binders });
    },
  });
}

export function useUpdateBinder(binderId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBinderInput) =>
      api<Binder>(`/v1/binders/${binderId}`, { method: 'PATCH', body: input }),
    onSuccess: (binder) => {
      queryClient.setQueryData(queryKeys.binder(binderId), binder);
      queryClient.invalidateQueries({ queryKey: queryKeys.binders });
    },
  });
}

export function useDeleteBinder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (binderId: string) => api<void>(`/v1/binders/${binderId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.binders }),
  });
}

/** Invalidates every share link the owner has handed out so far. */
export function useRotateShareToken(binderId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ shareToken: string }>(`/v1/binders/${binderId}/share-token/rotate`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.binder(binderId) }),
  });
}

export function useAddWantItem(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddWantItemInput) =>
      api<WantItem>(`/v1/wants/lists/${listId}/items`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wantItems(listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) });
    },
  });
}

export function useUpdateWantItem(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wantId, input }: { wantId: string; input: UpdateWantItemInput }) =>
      api<WantItem>(`/v1/wants/lists/${listId}/items/${wantId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wantItems(listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) });
    },
  });
}

export function useRemoveWantItem(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wantId: string) =>
      api<void>(`/v1/wants/lists/${listId}/items/${wantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wantItems(listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) });
    },
  });
}

function refreshTrades(queryClient: ReturnType<typeof useQueryClient>, tradeId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.trades });
  if (tradeId) queryClient.invalidateQueries({ queryKey: queryKeys.trade(tradeId) });
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
    queryFn: () => api<{ items: TradeChoice[] }>(`/v1/trades/${tradeId}/choices`),
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
