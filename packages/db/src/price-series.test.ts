import { describe, expect, it } from 'vitest';
import type { Database } from './client';
import { cardPriceSeries } from './price-series';

describe('cardPriceSeries', () => {
  it('maps a history row onto price fields', async () => {
    const db = {
      execute: () =>
        Promise.resolve([
          {
            recordedOn: '2026-01-02',
            usd: '1.00',
            usdFoil: null,
            usdEtched: '3.50',
            eur: '0.90',
            eurFoil: null,
            tix: '0.10',
          },
        ]),
    };

    const series = await cardPriceSeries(
      db as unknown as Database,
      '00000000-0000-4000-8000-000000000001',
      '2026-01-01',
      '2026-01-02',
    );

    expect(series).toEqual([
      {
        recordedOn: '2026-01-02',
        prices: {
          usd: '1.00',
          usd_foil: null,
          usd_etched: '3.50',
          eur: '0.90',
          eur_foil: null,
          tix: '0.10',
        },
      },
    ]);
  });
});
