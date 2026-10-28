import type {
  AddFriendInput,
  CollectionItem,
  Friend,
  Me,
  Page,
  Profile,
  TradeBinder,
  TradeMatch,
  UpdateProfileInput,
} from '@opulent/shared';
import { useAuth0 } from '@auth0/auth0-react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';
import { useMe } from '@/features/auth/queries';
import {
  binderSearchParams,
  emptyBinderSearch,
  type BinderSearch,
} from '@/shared/binder/binderSearch';
import { BINDER_PAGE_SIZE, useDebouncedSearch } from '@/shared/binder/useDebouncedSearch';

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
      void queryClient.invalidateQueries({ queryKey: ['trade-binder'] });
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
    queryFn: () => api<Profile>(`/v1/users/${encodeURIComponent(username ?? '')}`),
    enabled: Boolean(username) && (!isAuthenticated || me.isFetched),
  });
}

export function useFollowers(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.followers(username ?? ''),
    queryFn: () =>
      api<{ items: Friend[] }>(`/v1/users/${encodeURIComponent(username ?? '')}/followers`),
    enabled: Boolean(username),
  });
}

export function useFollowing(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.following(username ?? ''),
    queryFn: () =>
      api<{ items: Friend[] }>(`/v1/users/${encodeURIComponent(username ?? '')}/following`),
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
      api<void>(`/v1/users/me/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      void queryClient.invalidateQueries({ queryKey: ['followers'] });
      void queryClient.invalidateQueries({ queryKey: ['following'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

function tokenQuery(shareToken: string | undefined): string {
  return shareToken ? `?t=${encodeURIComponent(shareToken)}` : '';
}

export function useTradeBinder(handle: string | undefined, shareToken?: string) {
  const api = useApi();
  return useQuery({
    queryKey: [...queryKeys.tradeBinder(handle ?? ''), shareToken ?? ''],
    queryFn: () =>
      api<TradeBinder>(
        `/v1/users/${encodeURIComponent(handle ?? '')}/trade-binder${tokenQuery(shareToken)}`,
      ),
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
        `/v1/users/${encodeURIComponent(handle ?? '')}/trade-binder/items?${params.toString()}`,
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
        `/v1/users/${encodeURIComponent(handle ?? '')}/trade-binder/matches${tokenQuery(shareToken)}`,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: ['trade-binder'] });
    },
  });
}
