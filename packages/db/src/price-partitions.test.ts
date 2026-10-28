import { describe, expect, it } from 'vitest';
import type { Database } from './client';
import { ensurePricePartitions } from './price-partitions';

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (!chunk || typeof chunk !== 'object') return '';
      const record = chunk as { value?: unknown; queryChunks?: unknown[] };
      if (Array.isArray(record.value)) return record.value.join('');
      if (typeof record.value === 'string') return record.value;
      if (record.queryChunks) return sqlText(chunk);
      return '';
    })
    .join('');
}

describe('ensurePricePartitions', () => {
  it('creates one month table per month in the range', async () => {
    const statements: string[] = [];
    const db = {
      execute: (query: unknown) => {
        statements.push(sqlText(query));
        return Promise.resolve([]);
      },
    };

    await ensurePricePartitions(
      db as unknown as Pick<Database, 'execute'>,
      '2026-01-15',
      '2026-03-02',
    );

    const creates = statements
      .filter((statement) => statement.includes('CREATE TABLE'))
      .map((statement) => statement.replace(/\s+/g, ' ').trim());
    expect(creates).toEqual([
      "CREATE TABLE card_price_history_2026_01 PARTITION OF card_price_history FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')",
      "CREATE TABLE card_price_history_2026_02 PARTITION OF card_price_history FOR VALUES FROM ('2026-02-01') TO ('2026-03-01')",
      "CREATE TABLE card_price_history_2026_03 PARTITION OF card_price_history FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')",
    ]);
  });

  it('skips a month that already exists', async () => {
    const statements: string[] = [];
    let calls = 0;
    const db = {
      execute: (query: unknown) => {
        calls += 1;
        statements.push(sqlText(query));
        if (calls === 1) return Promise.resolve([{ name: 'card_price_history_2026_01' }]);
        return Promise.resolve([]);
      },
    };

    await ensurePricePartitions(
      db as unknown as Pick<Database, 'execute'>,
      '2026-01-01',
      '2026-02-01',
    );

    const creates = statements.filter((statement) => statement.includes('CREATE TABLE'));
    expect(creates).toHaveLength(1);
    expect(creates[0]).toContain('card_price_history_2026_02');
    expect(creates[0]).not.toContain('card_price_history_2026_01');
  });

  it('rejects a date that is not a day', async () => {
    const db = { execute: () => Promise.resolve([]) };
    await expect(
      ensurePricePartitions(
        db as unknown as Pick<Database, 'execute'>,
        "2026-01-01'; drop table users; --",
        '2026-02-01',
      ),
    ).rejects.toThrow(/two dates/);
  });
});
