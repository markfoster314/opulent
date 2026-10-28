import type { CardGroup, CreateCardGroupInput, UpdateCardGroupInput } from '@opulent/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';
import { refreshStacks } from '@/features/collection/queries';

export function useGroup(groupId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.group(groupId ?? 'none'),
    queryFn: () => api<CardGroup>(`/v1/groups/${encodeURIComponent(groupId ?? '')}`),
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
      api<CardGroup>(`/v1/groups/${encodeURIComponent(groupId)}`, { method: 'PATCH', body: input }),
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
    mutationFn: (groupId: string) =>
      api<void>(`/v1/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' }),
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
      api<{ ok: boolean }>(
        `/v1/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`,
        { method: 'POST' },
      ),
    onSuccess: () => refreshStacks(queryClient),
  });
}

export function useRemoveGroupMember(groupId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<void>(`/v1/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => refreshStacks(queryClient),
  });
}
