import type {
  AddBinderItemInput,
  AddWantItemInput,
  Binder,
  BinderItem,
  Card,
  CardSet,
  CompleteOnboardingInput,
  CreateBinderInput,
  UsernameAvailability,
  Me,
  PlaceRef,
  Page,
  TradeMatch,
  UpdateBinderInput,
  UpdateBinderItemInput,
  UpdateProfileInput,
  WantItem,
} from '@opulent/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiProvider';

/** Query key factory. Keeping the keys in one place makes cache busting reliable. */
export const queryKeys = {
  me: ['me'] as const,
  usernameAvailability: (username: string) => ['username-available', username] as const,
  binders: ['binders'] as const,
  binder: (id: string) => ['binder', id] as const,
  binderItems: (id: string) => ['binder', id, 'items'] as const,
  binderMatches: (id: string) => ['binder', id, 'matches'] as const,
  wants: ['wants'] as const,
  cardSearch: (term: string) => ['cards', 'search', term] as const,
  placeSearch: (term: string) => ['places', 'search', term] as const,
  cardPrintings: (oracleId: string, setFilter: string) =>
    ['cards', 'printings', oracleId, setFilter] as const,
  cardSets: (oracleId: string) => ['cards', 'sets', oracleId] as const,
  cardLanguages: (scryfallId: string) => ['cards', 'languages', scryfallId] as const,
  sharedBinder: (handle: string, slug: string) => ['binder', 'by', handle, slug] as const,
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
export function useBinderItems(binderId: string | undefined, shareToken?: string) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.binderItems(binderId ?? 'none'),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(BINDER_PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return api<Page<BinderItem>>(`/v1/binders/${binderId}/items?${params.toString()}`, {
        ...(shareToken ? { shareToken } : {}),
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(binderId),
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

export function useWants(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.wants,
    queryFn: () => api<{ items: WantItem[] }>('/v1/wants'),
    enabled,
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

export function useAddWant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddWantItemInput) =>
      api<WantItem>('/v1/wants', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wants }),
  });
}

export function useRemoveWant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wantId: string) => api<void>(`/v1/wants/${wantId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wants }),
  });
}
