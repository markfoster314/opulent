import type {
  CreateTradeInput,
  TradeChoices,
  TradeDetail,
  TradeLinesInput,
  TradeSummary,
} from '@opulent/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';

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
    queryFn: () => api<TradeDetail>(`/v1/trades/${encodeURIComponent(tradeId ?? '')}`),
    enabled: Boolean(tradeId),
  });
}

export function useTradeChoices(tradeId: string | undefined, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.tradeChoices(tradeId ?? ''),
    queryFn: () => api<TradeChoices>(`/v1/trades/${encodeURIComponent(tradeId ?? '')}/choices`),
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
      api<TradeDetail>(`/v1/trades/${encodeURIComponent(tradeId)}/propose`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => refreshTrades(queryClient, tradeId),
  });
}

export function useFinalizeTrade(tradeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TradeLinesInput) =>
      api<TradeDetail>(`/v1/trades/${encodeURIComponent(tradeId)}/finalize`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => refreshTrades(queryClient, tradeId),
  });
}

export function useCancelTrade(tradeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<TradeDetail>(`/v1/trades/${encodeURIComponent(tradeId)}/cancel`, { method: 'POST' }),
    onSuccess: () => refreshTrades(queryClient, tradeId),
  });
}
