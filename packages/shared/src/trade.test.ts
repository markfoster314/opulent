import { describe, expect, it } from 'vitest';
import { createTradeSchema, tradeSideValue } from './trade';

const printing = '11111111-1111-4111-8111-111111111111';

function line(quantity: number) {
  return { scryfallId: printing, quantity };
}

describe('tradeSideValue', () => {
  it('sums priced cards and treats a missing price as zero', () => {
    expect(
      tradeSideValue([
        { quantity: 2, marketPrice: '1.50' },
        { quantity: 1, marketPrice: null },
        { quantity: 4, marketPrice: 'nope' },
      ]),
    ).toBe(3);
  });
});

describe('createTradeSchema', () => {
  it('accepts one line of 999 and rejects an empty list, 101 lines, and a quantity of 1000', () => {
    expect(createTradeSchema.safeParse({ username: 'mark', items: [line(999)] }).success).toBe(
      true,
    );
    expect(createTradeSchema.safeParse({ username: 'mark', items: [] }).success).toBe(false);
    expect(
      createTradeSchema.safeParse({
        username: 'mark',
        items: Array.from({ length: 101 }, () => line(1)),
      }).success,
    ).toBe(false);
    expect(createTradeSchema.safeParse({ username: 'mark', items: [line(1000)] }).success).toBe(
      false,
    );
  });
});
