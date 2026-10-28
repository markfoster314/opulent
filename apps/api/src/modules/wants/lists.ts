import type { Database, WantListRow } from '@opulent/db';
import { users, wantItems, wantListItems, wantLists } from '@opulent/db';
import type { CreateWantListInput, UpdateWantListInput, WantList } from '@opulent/shared';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { ApiError, slugify } from '../../lib/http';

export async function ownedList(db: Database, userId: string, listId: string) {
  const rows = await db
    .select()
    .from(wantLists)
    .where(and(eq(wantLists.id, listId), eq(wantLists.userId, userId)))
    .limit(1);
  const list = rows[0];
  if (!list) throw ApiError.notFound('Want list not found');
  return list;
}

async function itemCountFor(db: Database, listId: string): Promise<number> {
  const counts = await db
    .select({ itemCount: sql<number>`coalesce(sum(${wantItems.quantity}), 0)::int` })
    .from(wantListItems)
    .innerJoin(wantItems, eq(wantItems.id, wantListItems.wantItemId))
    .where(eq(wantListItems.wantListId, listId));
  return Number(counts[0]?.itemCount ?? 0);
}

function toWantList(row: WantListRow, itemCount: number, includeToken: boolean): WantList {
  return {
    id: row.id,
    userId: row.userId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(includeToken ? { shareToken: row.shareToken } : {}),
  };
}

export function assertCanViewWantList(
  list: WantListRow,
  viewer: { userId?: string | undefined; shareToken?: string | undefined },
): void {
  if (viewer.userId && list.userId === viewer.userId) return;
  if (list.visibility === 'public') return;
  if (list.visibility === 'unlisted' && viewer.shareToken === list.shareToken) return;
  throw ApiError.notFound('Want list not found');
}

export async function listWantLists(db: Database, userId: string): Promise<WantList[]> {
  const rows = await db
    .select()
    .from(wantLists)
    .where(eq(wantLists.userId, userId))
    .orderBy(asc(wantLists.name), asc(wantLists.id));

  const totals = new Map<string, number>();
  if (rows.length > 0) {
    const counts = await db
      .select({
        id: wantListItems.wantListId,
        itemCount: sql<number>`coalesce(sum(${wantItems.quantity}), 0)::int`,
      })
      .from(wantListItems)
      .innerJoin(wantItems, eq(wantItems.id, wantListItems.wantItemId))
      .where(
        inArray(
          wantListItems.wantListId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(wantListItems.wantListId);
    for (const count of counts) totals.set(count.id, Number(count.itemCount));
  }

  return rows.map((row) => toWantList(row, totals.get(row.id) ?? 0, true));
}

export async function createWantList(
  db: Database,
  userId: string,
  input: CreateWantListInput,
): Promise<WantList> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw ApiError.badRequest('Could not build a link name from that name');

  const existing = await db
    .select({ id: wantLists.id })
    .from(wantLists)
    .where(and(eq(wantLists.userId, userId), eq(wantLists.slug, slug)))
    .limit(1);
  if (existing.length > 0) {
    throw ApiError.conflict(`You already have a list at /${slug}`);
  }

  const inserted = await db
    .insert(wantLists)
    .values({
      userId,
      slug,
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new ApiError('internal_error', 'Could not create the list');
  return toWantList(row, 0, true);
}

export async function getWantList(db: Database, userId: string, listId: string): Promise<WantList> {
  const row = await ownedList(db, userId, listId);
  return toWantList(row, await itemCountFor(db, listId), true);
}

export async function toPublicWantList(
  db: Database,
  row: WantListRow,
  viewerUserId: string | undefined,
): Promise<WantList> {
  const includeToken = Boolean(viewerUserId && row.userId === viewerUserId);
  return toWantList(row, await itemCountFor(db, row.id), includeToken);
}

export async function getWantListByHandleAndSlug(
  db: Database,
  handle: string,
  slug: string,
): Promise<WantListRow> {
  const rows = await db
    .select()
    .from(wantLists)
    .innerJoin(users, eq(users.id, wantLists.userId))
    .where(and(eq(users.username, handle), eq(wantLists.slug, slug)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Want list not found');
  return row.want_lists;
}

export async function updateWantList(
  db: Database,
  userId: string,
  listId: string,
  input: UpdateWantListInput,
): Promise<WantList> {
  await ownedList(db, userId, listId);
  if (input.slug) {
    const taken = await db
      .select({ id: wantLists.id })
      .from(wantLists)
      .where(
        and(eq(wantLists.userId, userId), eq(wantLists.slug, input.slug), ne(wantLists.id, listId)),
      )
      .limit(1);
    if (taken.length > 0) {
      throw ApiError.conflict(`You already have a list at /${input.slug}`);
    }
  }
  await db
    .update(wantLists)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(wantLists.id, listId), eq(wantLists.userId, userId)));
  return getWantList(db, userId, listId);
}

export async function rotateWantShareToken(db: Database, listId: string): Promise<string> {
  const updated = await db
    .update(wantLists)
    .set({ shareToken: sql`encode(gen_random_bytes(16), 'hex')`, updatedAt: new Date() })
    .where(eq(wantLists.id, listId))
    .returning({ shareToken: wantLists.shareToken });
  const token = updated[0]?.shareToken;
  if (!token) throw ApiError.notFound('Want list not found');
  return token;
}

export async function deleteWantList(db: Database, userId: string, listId: string): Promise<void> {
  await ownedList(db, userId, listId);
  await db.delete(wantLists).where(and(eq(wantLists.id, listId), eq(wantLists.userId, userId)));
}
