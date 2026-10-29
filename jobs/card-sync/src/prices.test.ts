import type { Database } from '@opulent/db';
import { describe, expect, it } from 'vitest';
import { recordDailyPrices } from './prices';

describe('recordDailyPrices', () => {
  it('returns the count of price rows written', async () => {
    const db = {
      execute: () => Promise.resolve([]),
      transaction: (fn: (tx: { execute: () => Promise<{ count: number }> }) => Promise<number>) =>
        fn({ execute: () => Promise.resolve({ count: 4 }) }),
    };
    await expect(recordDailyPrices(db as unknown as Database)).resolves.toBe(4);
  });

  it('returns zero when the write reports no count', async () => {
    const db = {
      execute: () => Promise.resolve([]),
      transaction: (
        fn: (tx: { execute: () => Promise<Record<string, never>> }) => Promise<number>,
      ) => fn({ execute: () => Promise.resolve({}) }),
    };
    await expect(recordDailyPrices(db as unknown as Database)).resolves.toBe(0);
  });
});
