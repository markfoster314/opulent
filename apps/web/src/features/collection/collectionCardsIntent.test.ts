import { describe, expect, it } from 'vitest';
import { emptyBinderSearch } from '@/shared/binder/binderSearch';
import { applyCollectionCardsIntent, readCollectionCardsIntent } from './collectionCardsIntent';

describe('readCollectionCardsIntent', () => {
  it('returns empty for junk', () => {
    expect(readCollectionCardsIntent(null)).toEqual({});
    expect(readCollectionCardsIntent('nope')).toEqual({});
    expect(readCollectionCardsIntent({ sort: 'nope', cardId: 1 })).toEqual({});
  });

  it('keeps known fields', () => {
    expect(
      readCollectionCardsIntent({
        cardId: 'abc',
        sort: 'change',
        dir: 'asc',
        range: '6m',
        changeMode: 'percent',
      }),
    ).toEqual({
      cardId: 'abc',
      sort: 'change',
      dir: 'asc',
      range: '6m',
      changeMode: 'percent',
    });
  });
});

describe('applyCollectionCardsIntent', () => {
  it('seeds search without touching card id', () => {
    const search = applyCollectionCardsIntent(emptyBinderSearch, {
      cardId: 'abc',
      sort: 'name',
      dir: 'asc',
    });
    expect(search.sort).toBe('name');
    expect(search.dir).toBe('asc');
    expect(search.q).toBe('');
  });
});
