import { describe, expect, it } from 'vitest';
import { formatUsd, marketPrices, priceForFinish } from './card';

describe('priceForFinish', () => {
  const prices = { usd: '1.00', usd_foil: '2.00', usd_etched: '3.00' };

  it('returns null when the printing has no prices', () => {
    expect(priceForFinish(null, 'nonfoil')).toBeNull();
    expect(priceForFinish(undefined, 'foil')).toBeNull();
  });

  it('reads the column for that finish', () => {
    expect(priceForFinish(prices, 'nonfoil')).toBe('1.00');
    expect(priceForFinish(prices, 'foil')).toBe('2.00');
    expect(priceForFinish(prices, 'etched')).toBe('3.00');
    expect(priceForFinish({}, 'foil')).toBeNull();
  });
});

describe('marketPrices', () => {
  it('returns null when neither printing has a price', () => {
    expect(marketPrices(null, null)).toBeNull();
    expect(marketPrices({}, { usd: '' })).toBeNull();
  });

  it('uses the english price when the printing has none', () => {
    expect(marketPrices({ usd: '1.00' }, { usd: '9.00', usd_foil: '4.00' })).toEqual({
      usd: '1.00',
      usd_foil: '4.00',
    });
  });
});

describe('formatUsd', () => {
  it('returns null when the value is missing or not a number', () => {
    expect(formatUsd(null)).toBeNull();
    expect(formatUsd('')).toBeNull();
    expect(formatUsd('nope')).toBeNull();
  });

  it('formats a dollar amount', () => {
    expect(formatUsd('1.5')).toBe('$1.50');
  });
});
