import { sql } from 'drizzle-orm';
import type { Database } from './client';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The one method these helpers need, so a plain drizzle handle also fits. */
type Executor = Pick<Database, 'execute'>;

/** Creates the partitions a writer needs, since an insert with no partition fails; month-named tables make retention one DROP, with no delete or vacuum. */

export async function ensurePricePartitions(db: Executor, from: string, to: string): Promise<void> {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`ensurePricePartitions needs two dates, got "${from}" and "${to}"`);
  }

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  // Read the existing months first: a duplicate CREATE is harmless but logs a notice that looks like a fault.
  const known = (await db.execute(sql`
    SELECT c.relname AS name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = 'card_price_history'::regclass
  `)) as unknown as { name: string }[];
  const existing = new Set(known.map((row) => row.name));

  while (cursor <= last) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const name = `card_price_history_${cursor.getUTCFullYear()}_${String(
      cursor.getUTCMonth() + 1,
    ).padStart(2, '0')}`;

    if (!existing.has(name)) {
      // Bounds must be statement text, not bind parameters, which PostgreSQL rejects; both strings come from isoDay.
      await db.execute(sql`
        CREATE TABLE ${sql.identifier(name)}
        PARTITION OF card_price_history
        FOR VALUES FROM (${sql.raw(`'${isoDay(cursor)}'`)}) TO (${sql.raw(`'${isoDay(next)}'`)})
      `);
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

/** The range the nightly job keeps ready: a margin behind today for late corrections, a few months ahead so it never fails at a month boundary. */
export function pricePartitionWindow(): { from: string; to: string } {
  const now = Date.now();
  return {
    from: isoDay(new Date(now - 45 * DAY_MS)),
    to: isoDay(new Date(now + 120 * DAY_MS)),
  };
}
