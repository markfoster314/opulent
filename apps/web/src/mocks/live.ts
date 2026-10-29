import type { CollectionSummary, MatchOwner, Me, TradeSummary } from '@opulent/shared';
import { mockMatch, mockSummary, mockTrade } from './fixtures';

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(sequence).padStart(12, '0')}`;
}

export const live: {
  me: Me | null;
  trades: TradeSummary[];
  matches: MatchOwner[];
  summary: CollectionSummary;
} = {
  me: null,
  trades: [mockTrade],
  matches: [mockMatch],
  summary: mockSummary,
};

export function resetLive(): void {
  live.me = null;
  live.trades = [mockTrade];
  live.matches = [mockMatch];
  live.summary = mockSummary;
  sequence = 0;
}

export function addTradeRequest(): void {
  live.trades = [
    ...live.trades,
    {
      ...mockTrade,
      id: nextId(),
      partnerUsername: 'friend_two',
      yourTurn: true,
      youFinalized: false,
      theyFinalized: false,
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function addMatch(): void {
  live.matches = [
    ...live.matches,
    { ...mockMatch, username: 'friend_two', city: 'Austin', distanceMeters: 1200, matchCount: 2 },
  ];
}

export function bumpPrice(): void {
  live.summary = {
    ...live.summary,
    cardCount: live.summary.cardCount + 1,
    marketValue: '124.00',
    forTradeValue: '124.00',
  };
}
