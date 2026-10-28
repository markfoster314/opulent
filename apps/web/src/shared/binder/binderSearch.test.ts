import { describe, expect, it } from 'vitest';
import {
  binderSearchIsActive,
  binderSearchParams,
  clearBinderFilters,
  emptyBinderSearch,
} from './binderSearch';

describe('binderSearchIsActive', () => {
  it('is off for empty search even when sort is set', () => {
    expect(binderSearchIsActive(emptyBinderSearch)).toBe(false);
    expect(
      binderSearchIsActive({ ...emptyBinderSearch, sort: 'name', dir: 'asc', range: '1y' }),
    ).toBe(false);
  });

  it('is on when a filter is set', () => {
    expect(binderSearchIsActive({ ...emptyBinderSearch, q: 'lotus' })).toBe(true);
    expect(binderSearchIsActive({ ...emptyBinderSearch, forTrade: true })).toBe(true);
  });
});

describe('binderSearchParams', () => {
  it('always sends sort, dir, range, and changeBy', () => {
    const params = binderSearchParams(emptyBinderSearch, null, 50);
    expect(params.get('limit')).toBe('50');
    expect(params.get('sort')).toBe('price');
    expect(params.get('dir')).toBe('desc');
    expect(params.get('range')).toBe('1w');
    expect(params.get('changeBy')).toBe('amount');
    expect(params.has('q')).toBe(false);
  });

  it('adds cursor and trimmed filters', () => {
    const params = binderSearchParams(
      { ...emptyBinderSearch, q: '  bolt  ', set: 'mh2', forTrade: true },
      'cursor-1',
      20,
    );
    expect(params.get('cursor')).toBe('cursor-1');
    expect(params.get('q')).toBe('bolt');
    expect(params.get('set')).toBe('mh2');
    expect(params.get('forTrade')).toBe('true');
  });
});

describe('clearBinderFilters', () => {
  it('keeps ordering and range', () => {
    const cleared = clearBinderFilters({
      ...emptyBinderSearch,
      q: 'bolt',
      sort: 'name',
      dir: 'asc',
      range: '1y',
      changeMode: 'percent',
    });
    expect(cleared.q).toBe('');
    expect(cleared.sort).toBe('name');
    expect(cleared.dir).toBe('asc');
    expect(cleared.range).toBe('1y');
    expect(cleared.changeMode).toBe('percent');
  });
});
