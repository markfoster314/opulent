import type {
  AddWantItemInput,
  CreateGenericWantInput,
  CreateWantListInput,
  GenericWant,
  UpdateWantItemInput,
  UpdateWantListInput,
  WantItem,
  WantList,
  WantsImportInput,
  WantsImportResult,
} from '@opulent/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';

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
    },
  });
}

/** Returns want CSV text; the caller hands it to the browser as a file. */
export function useExportWants(listId?: string) {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api<string>(
        listId
          ? `/v1/wants/lists/${encodeURIComponent(listId)}/export.csv`
          : '/v1/wants/export.csv',
        {
          asText: true,
        },
      ),
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
    mutationFn: (wantId: string) =>
      api<void>(`/v1/wants/generic/${encodeURIComponent(wantId)}`, { method: 'DELETE' }),
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
    queryFn: () => api<WantList>(`/v1/wants/lists/${encodeURIComponent(listId ?? '')}`),
    enabled: Boolean(listId),
  });
}

export function useWantItems(listId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.wantItems(listId ?? 'none'),
    queryFn: () =>
      api<{ items: WantItem[] }>(`/v1/wants/lists/${encodeURIComponent(listId ?? '')}/items`),
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
    queryFn: () =>
      api<{ items: WantItem[] }>(`/v1/wants/by/${encodeURIComponent(handle ?? '')}/public-items`),
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
    queryKey: [...queryKeys.sharedWantList(handle ?? '', slug ?? ''), shareToken ?? ''],
    queryFn: () =>
      api<WantList>(
        `/v1/wants/by/${encodeURIComponent(handle ?? '')}/${encodeURIComponent(slug ?? '')}`,
        {
          ...(shareToken ? { shareToken } : {}),
        },
      ),
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
    queryKey: [...queryKeys.sharedWantItems(handle ?? '', slug ?? ''), shareToken ?? ''],
    queryFn: () =>
      api<{ items: WantItem[] }>(
        `/v1/wants/by/${encodeURIComponent(handle ?? '')}/${encodeURIComponent(slug ?? '')}/items`,
        {
          ...(shareToken ? { shareToken } : {}),
        },
      ),
    enabled: Boolean(handle && slug),
  });
}

export function useUpdateWantList(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWantListInput) =>
      api<WantList>(`/v1/wants/lists/${encodeURIComponent(listId)}`, {
        method: 'PATCH',
        body: input,
      }),
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
      api<{ shareToken: string }>(
        `/v1/wants/lists/${encodeURIComponent(listId)}/share-token/rotate`,
        { method: 'POST' },
      ),
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
    mutationFn: (listId: string) =>
      api<void>(`/v1/wants/lists/${encodeURIComponent(listId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wants }),
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
      api<WantItem>(`/v1/wants/items/${encodeURIComponent(wantId)}`, {
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
    mutationFn: (wantId: string) =>
      api<void>(`/v1/wants/items/${encodeURIComponent(wantId)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
    },
  });
}

export function useRemoveWantItem(listId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    // Removing from a list leaves the want in All wants.
    mutationFn: (wantId: string) =>
      api<void>(
        `/v1/wants/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(wantId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wantItems(listId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wants });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allWantItems });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wantList(listId) });
    },
  });
}
