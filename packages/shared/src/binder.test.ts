import { describe, expect, it } from 'vitest';
import {
  askingPrice,
  askingPriceForFinish,
  collectionItemQuerySchema,
  itemPriceSchema,
  parseCustomAmount,
  parsePhotoLink,
  photoLinkSchema,
  slugSchema,
} from './binder';

describe('parseCustomAmount', () => {
  it('keeps a price from one cent to the cap', () => {
    expect(parseCustomAmount(' 1.5 ')).toBe('1.50');
    expect(parseCustomAmount('0.01')).toBe('0.01');
    expect(parseCustomAmount('99999.99')).toBe('99999.99');
  });

  it('returns null when the text is not that price', () => {
    expect(parseCustomAmount('')).toBeNull();
    expect(parseCustomAmount('0')).toBeNull();
    expect(parseCustomAmount('100000')).toBeNull();
    expect(parseCustomAmount('1.234')).toBeNull();
    expect(parseCustomAmount('nope')).toBeNull();
  });
});

describe('parsePhotoLink', () => {
  it('keeps an http address', () => {
    expect(parsePhotoLink(' https://example.com/card ')).toBe('https://example.com/card');
    expect(parsePhotoLink('http://example.com/a')).toBe('http://example.com/a');
  });

  it('returns null when the text is not an http address', () => {
    expect(parsePhotoLink('')).toBeNull();
    expect(parsePhotoLink('see example.com')).toBeNull();
    expect(parsePhotoLink(`https://example.com/${'a'.repeat(2000)}`)).toBeNull();
  });
});

describe('askingPrice', () => {
  it('returns the custom amount when the kind is custom', () => {
    expect(askingPrice('9.00', { kind: 'custom', amount: '2.5' })).toBe('2.50');
    expect(askingPrice('9.00', { kind: 'custom', amount: 'nope' })).toBeNull();
  });

  it('returns the market price when the kind is market', () => {
    expect(askingPrice('3.00', { kind: 'market' })).toBe('3.00');
    expect(askingPrice(null, { kind: 'market' })).toBeNull();
  });

  it('scales the market price when the kind is percent', () => {
    expect(askingPrice('2.00', { kind: 'percent', percent: 50 })).toBe('1.00');
    expect(askingPrice(null, { kind: 'percent', percent: 50 })).toBeNull();
    expect(askingPrice('nope', { kind: 'percent', percent: 50 })).toBeNull();
  });
});

describe('askingPriceForFinish', () => {
  it('uses the foil column when the finish is foil', () => {
    expect(
      askingPriceForFinish({ usd: '1.00', usd_foil: '4.00' }, 'foil', { kind: 'market' }),
    ).toBe('4.00');
  });
});

describe('binder schemas', () => {
  it('accepts a slug, a market price, and a photo link', () => {
    expect(slugSchema.parse('my-list')).toBe('my-list');
    expect(itemPriceSchema.parse({ kind: 'market' })).toEqual({ kind: 'market' });
    expect(photoLinkSchema.parse('https://example.com/a')).toBe('https://example.com/a');
  });

  it('rejects a bad slug, a bad custom price, and a sentence', () => {
    expect(slugSchema.safeParse('My List').success).toBe(false);
    expect(itemPriceSchema.safeParse({ kind: 'custom', amount: 'nope' }).success).toBe(false);
    expect(itemPriceSchema.safeParse({ kind: 'percent', percent: 150 }).success).toBe(false);
    expect(photoLinkSchema.safeParse('not a link').success).toBe(false);
  });

  it('turns query flags into booleans and drops a blank name', () => {
    const parsed = collectionItemQuerySchema.parse({
      limit: '10',
      q: '  ',
      forTrade: 'true',
      signed: 'false',
    });
    expect(parsed.limit).toBe(10);
    expect(parsed.q).toBeUndefined();
    expect(parsed.forTrade).toBe(true);
    expect(parsed.signed).toBe(false);
  });
});
