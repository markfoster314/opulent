import type { Database, NewCardRow } from '@opulent/db';
import { CARD_GAME } from '@opulent/shared';
import { describe, expect, it } from 'vitest';
import type { CatalogSource } from './catalog';
import { BATCH_SIZE, importCatalog } from './importer';

function row(n: number, game = CARD_GAME): NewCardRow {
  return {
    scryfallId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    oracleId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    game,
    name: `Card ${n}`,
    setCode: 'tst',
    collectorNumber: String(n),
    raw: {},
    syncedAt: new Date(),
  };
}

function source(items: Array<NewCardRow | null>): CatalogSource<NewCardRow | null> {
  return {
    name: 'fake',
    game: CARD_GAME,
    async *list() {
      for (const item of items) {
        await Promise.resolve();
        yield item;
      }
    },
    toRow: (item) => item,
  };
}

function fakeDb(batches: NewCardRow[][]): Database {
  return {
    insert: () => ({
      values: (batch: NewCardRow[]) => ({
        onConflictDoUpdate: () => {
          batches.push(batch);
          return Promise.resolve();
        },
      }),
    }),
  } as unknown as Database;
}

describe('importCatalog', () => {
  it('writes a full batch, then the remainder', async () => {
    const batches: NewCardRow[][] = [];
    const items = Array.from({ length: BATCH_SIZE + 1 }, (_, index) => row(index + 1));
    const stats = await importCatalog(fakeDb(batches), source(items));

    expect(stats).toEqual({ read: BATCH_SIZE + 1, written: BATCH_SIZE + 1, skipped: 0 });
    expect(batches.map((batch) => batch.length)).toEqual([BATCH_SIZE, 1]);
  });

  it('counts a skipped row and leaves it out of the write', async () => {
    const batches: NewCardRow[][] = [];
    const stats = await importCatalog(fakeDb(batches), source([row(1), null, row(2)]));

    expect(stats).toEqual({ read: 3, written: 2, skipped: 1 });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it('rejects a row for a different game before writing it', async () => {
    const batches: NewCardRow[][] = [];
    await expect(importCatalog(fakeDb(batches), source([row(1, 'other')]))).rejects.toThrow(
      /game "other"/,
    );
    expect(batches).toHaveLength(0);
  });
});
