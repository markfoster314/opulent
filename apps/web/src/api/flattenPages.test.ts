import { describe, expect, it } from 'vitest';
import { flattenPages } from './flattenPages';

describe('flattenPages', () => {
  it('returns an empty list when there are no pages', () => {
    expect(flattenPages(undefined)).toEqual([]);
  });

  it('joins the items from each page', () => {
    expect(flattenPages([{ items: ['a'] }, { items: ['b', 'c'] }])).toEqual(['a', 'b', 'c']);
  });
});
