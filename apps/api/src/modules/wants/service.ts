import type { Database } from '@opulent/db';
import { cards, wantItems } from '@opulent/db';
import type {
  AddWantItemInput,
  UpdateWantItemInput,
  WantItem,
  WantPriority,
} from '@opulent/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';

const wantSelection = {
  id: wantItems.id,
  userId: wantItems.userId,
  oracleId: wantItems.oracleId,
  quantity: wantItems.quantity,
  priority: wantItems.priority,
  notes: wantItems.notes,
  // A want points at a card concept, which has no single name row, so take any
  // printing's name for display.
  cardName: sql<string | null>`(
    SELECT ${cards.name} FROM ${cards}
    WHERE ${cards.oracleId} = ${wantItems.oracleId}
    LIMIT 1
  )`,
};

type WantRow = {
  id: string;
  userId: string;
  oracleId: string;
  quantity: number;
  priority: number;
  notes: string | null;
  cardName: string | null;
};

function toWantItem(row: WantRow): WantItem {
  return {
    id: row.id,
    userId: row.userId,
    oracleId: row.oracleId,
    quantity: row.quantity,
    priority: (row.priority as WantPriority) ?? 2,
    notes: row.notes,
    ...(row.cardName ? { cardName: row.cardName } : {}),
  };
}

export async function listWants(db: Database, userId: string): Promise<WantItem[]> {
  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .where(eq(wantItems.userId, userId))
    .orderBy(asc(wantItems.priority));
  return rows.map(toWantItem);
}

/** Adding a card already on the list raises the quantity instead of failing. */
export async function addWant(
  db: Database,
  userId: string,
  input: AddWantItemInput,
): Promise<WantItem> {
  const known = await db
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(eq(cards.oracleId, input.oracleId))
    .limit(1);
  if (known.length === 0) {
    throw ApiError.badRequest('Unknown card. The local Scryfall mirror may be out of date.');
  }

  const inserted = await db
    .insert(wantItems)
    .values({
      userId,
      oracleId: input.oracleId,
      quantity: input.quantity,
      priority: input.priority,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [wantItems.userId, wantItems.oracleId],
      set: {
        quantity: sql`${wantItems.quantity} + ${input.quantity}`,
        priority: input.priority,
        updatedAt: new Date(),
      },
    })
    .returning({ id: wantItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the want');

  const rows = await db.select(wantSelection).from(wantItems).where(eq(wantItems.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('internal_error', 'Could not read back the want');
  return toWantItem(row);
}

export async function updateWant(
  db: Database,
  userId: string,
  wantId: string,
  input: UpdateWantItemInput,
): Promise<WantItem> {
  const updated = await db
    .update(wantItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(wantItems.id, wantId), eq(wantItems.userId, userId)))
    .returning({ id: wantItems.id });

  if (!updated[0]) throw ApiError.notFound('Want not found');

  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .where(eq(wantItems.id, wantId))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Want not found');
  return toWantItem(row);
}

export async function removeWant(db: Database, userId: string, wantId: string): Promise<void> {
  await db.delete(wantItems).where(and(eq(wantItems.id, wantId), eq(wantItems.userId, userId)));
}
