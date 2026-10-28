import { describe, expect, it } from 'vitest';
import { createTradeSchema } from './trade';

const printing = '11111111-1111-4111-8111-111111111111';

function line(quantity: number) {
  return { scryfallId: printing, quantity };
}

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
