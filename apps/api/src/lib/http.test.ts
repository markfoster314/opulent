import { describe, expect, it } from 'vitest';
import { slugify } from './http';

describe('slugify', () => {
  it('normalizes a title into a short url segment', () => {
    expect(slugify('  My Wants: Trading & More!  ')).toBe('my-wants-trading-more');
  });

  it('caps the result at sixty characters', () => {
    expect(slugify('a'.repeat(80))).toHaveLength(60);
  });
});
