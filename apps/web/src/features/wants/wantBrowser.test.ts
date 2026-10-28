import { describe, expect, it } from 'vitest';
import type { WantItem } from '@opulent/shared';
import { sortWants } from './wantBrowser';

function want(id: string, cardName: string, priority: 1 | 2 | 3, quantity: number): WantItem {
  return {
    id,
    userId: '00000000-0000-4000-8000-000000000000',
    oracleId: '00000000-0000-4000-8000-000000000001',
    cardName,
    quantity,
    priority,
    notes: null,
    wantedLanguages: [],
    wantedFinishes: [],
    wantedConditions: [],
    wantedSets: [],
    lists: [],
  };
}

describe('sortWants', () => {
  const items = [want('b', 'Black', 2, 3), want('a', 'Alpha', 1, 1), want('c', 'Charlie', 3, 2)];

  it('sorts by priority with high first', () => {
    expect(sortWants(items, 'priority', 'asc').map((item) => item.cardName)).toEqual([
      'Alpha',
      'Black',
      'Charlie',
    ]);
  });

  it('sorts by quantity descending', () => {
    expect(sortWants(items, 'quantity', 'desc').map((item) => item.quantity)).toEqual([3, 2, 1]);
  });

  it('sorts by name without mutating the source', () => {
    expect(sortWants(items, 'name', 'desc').map((item) => item.cardName)).toEqual([
      'Charlie',
      'Black',
      'Alpha',
    ]);
    expect(items.map((item) => item.cardName)).toEqual(['Black', 'Alpha', 'Charlie']);
  });
});
