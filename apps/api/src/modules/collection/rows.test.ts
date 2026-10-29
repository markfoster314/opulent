import type { Database } from '@opulent/db';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/http';
import {
  collectionItemFilters,
  containsPattern,
  decodeCursor,
  encodeCursor,
  englishPrintingJoin,
  loadGroupsForItems,
  priceColumns,
  toCollectionItem,
} from './rows';

const id = '00000000-0000-4000-8000-000000000001';
const groupId = '00000000-0000-4000-8000-000000000010';

function row(priceKind: 'market' | 'percent' | 'custom') {
  return {
    id,
    scryfallId: id,
    quantity: 2,
    finish: 'foil' as const,
    condition: 'NM' as const,
    language: priceKind === 'market' ? 'xx' : 'fr',
    signed: false,
    altered: false,
    misprint: false,
    miscut: false,
    artistProof: false,
    notes: null,
    photoUrl: null,
    forTrade: true,
    priceKind,
    pricePercent: 40,
    priceAmount: '1.50',
    cardName: 'Solitude',
    cardSetCode: 'mh2',
    cardSetName: 'Modern Horizons 2',
    cardCollectorNumber: '1',
    cardRarity: 'rare',
    cardOracleId: id,
    cardImageUris: null,
    cardPrices: priceKind === 'percent' ? { usd_foil: '4.00' } : null,
    cardFinishes: ['foil', 'shiny'],
    cardLayout: 'normal',
    cardTypeLine: 'Creature',
    cardManaCost: '{W}',
    cardScryfallUri: 'https://scryfall.com/card/mh2/1',
    cardReleasedAt: '2021-06-18',
    cardOracleText: null,
    cardArtist: 'Igor',
    englishPrices: { usd: '2.00', usd_foil: '8.00' },
  };
}

describe('priceColumns', () => {
  it('fills market columns when no price is chosen', () => {
    expect(priceColumns(undefined)).toEqual({
      priceKind: 'market',
      pricePercent: 100,
      priceAmount: '',
    });
  });

  it('keeps a percent and a custom amount', () => {
    expect(priceColumns({ kind: 'percent', percent: 80 })).toEqual({
      priceKind: 'percent',
      pricePercent: 80,
      priceAmount: '',
    });
    expect(priceColumns({ kind: 'custom', amount: '1.5' })).toEqual({
      priceKind: 'custom',
      pricePercent: 0,
      priceAmount: '1.50',
    });
    expect(priceColumns({ kind: 'custom', amount: 'nope' }).priceAmount).toBe('nope');
  });
});

describe('toCollectionItem', () => {
  it('uses english when the language code is not listed', () => {
    const item = toCollectionItem(row('market') as never, []);
    expect(item.language).toBe('en');
    expect(item.price).toEqual({ kind: 'market' });
    expect(item.availableFinishes).toEqual(['foil']);
    expect(item.card.prices).toEqual({ usd: '2.00', usd_foil: '8.00' });
  });

  it('keeps a percent price and the printing language', () => {
    const item = toCollectionItem(row('percent') as never, [{ id: groupId, name: 'Trades' }]);
    expect(item.language).toBe('fr');
    expect(item.price).toEqual({ kind: 'percent', percent: 40 });
    expect(item.groups).toEqual([{ id: groupId, name: 'Trades' }]);
    expect(item.card.prices?.usd_foil).toBe('4.00');
  });

  it('keeps a custom price', () => {
    expect(toCollectionItem(row('custom') as never, []).price).toEqual({
      kind: 'custom',
      amount: '1.50',
    });
  });
});

describe('containsPattern', () => {
  it('escapes like wildcards', () => {
    expect(containsPattern('100%_off\\')).toBe('%100\\%\\_off\\\\%');
  });
});

describe('collectionItemFilters', () => {
  it('keeps only the game rule when no filter is set', () => {
    expect(collectionItemFilters({ limit: 20 }, undefined)).toHaveLength(1);
  });

  it('adds a clause for each chosen filter', () => {
    const clauses = collectionItemFilters(
      {
        limit: 20,
        q: 'solitude',
        set: 'mh2',
        finish: 'foil',
        condition: 'NM',
        language: 'en',
        rarity: 'rare',
        type: 'creature',
        artist: 'Igor',
        groupId,
        forTrade: true,
        signed: true,
        altered: true,
        misprint: true,
        miscut: true,
        artistProof: true,
        onWantList: true,
        onGenericWant: true,
      },
      id,
    );
    expect(clauses).toHaveLength(18);
  });

  it('refuses a want-list filter when nobody is signed in', () => {
    expect(() => collectionItemFilters({ limit: 20, onWantList: true }, undefined)).toThrow(
      ApiError,
    );
    expect(() => collectionItemFilters({ limit: 20, onGenericWant: true }, undefined)).toThrow(
      /generic wants/,
    );
  });
});

describe('cursors', () => {
  it('reads a name and an id from the cursor', () => {
    const cursor = 'U29saXR1ZGUAMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAx';
    expect(encodeCursor('Solitude', id)).toBe(cursor);
    expect(decodeCursor(cursor)).toEqual({ name: 'Solitude', id });
  });

  it('returns undefined when the cursor is missing', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
    expect(decodeCursor('')).toBeUndefined();
  });

  it('rejects a cursor that has no separator', () => {
    expect(() => decodeCursor('YQ')).toThrow(/Malformed cursor/);
  });
});

describe('englishPrintingJoin', () => {
  it('builds a join', () => {
    expect(englishPrintingJoin()).toBeDefined();
  });
});

describe('loadGroupsForItems', () => {
  it('returns an empty map when there are no items', async () => {
    const db = {
      select: () => {
        throw new Error('should not query');
      },
    };
    const groups = await loadGroupsForItems(db as unknown as Database, []);
    expect(groups.size).toBe(0);
  });
});
