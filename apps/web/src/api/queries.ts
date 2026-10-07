import type {
  AddBinderItemInput,
  AddWantItemInput,
  Binder,
  BinderItem,
  Card,
  CreateBinderInput,
  Me,
  Page,
  TradeMatch,
  UpdateBinderInput,
  UpdateBinderItemInput,
  WantItem,
} from '@opulent/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './ApiProvider';

/** Query key factory. Keeping the keys in one place makes cache busting reliable. */
export const queryKeys = {
  me: ['me'] as const,
  binders: ['binders'] as const,
  binder: (id: string) => ['binder', id] as const,
  binderItems: (id: string) => ['binder', id, 'items'] as const,
  binderMatches: (id: string) => ['binder', id, 'matches'] as const,
  wants: ['wants'] as const,
  cardSearch: (term: string) => ['cards', 'search', term] as const,
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
