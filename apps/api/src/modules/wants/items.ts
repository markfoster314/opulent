import type { Database } from '@opulent/db';
import { cards, wantItems, wantListItems, wantLists } from '@opulent/db';
import type {
  AddWantItemInput,
  CardImageUris,
  UpdateWantItemInput,
  WantItem,
  WantPriority,
} from '@opulent/shared';
import { CARD_GAME, wantScopeKey } from '@opulent/shared';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { ownedList } from './lists';

const scopeColumns = {
  wantedLanguages: wantItems.wantedLanguages,
  wantedFinishes: wantItems.wantedFinishes,
  wantedConditions: wantItems.wantedConditions,
  wantedSets: wantItems.wantedSets,
};

const wantSelection = {
  id: wantItems.id,
  userId: wantItems.userId,
  oracleId: wantItems.oracleId,
  quantity: wantItems.quantity,
  priority: wantItems.priority,
  notes: wantItems.notes,
  ...scopeColumns,
};

type WantRow = {
  id: string;
  userId: string;
  oracleId: string;
  quantity: number;
  priority: number;
  notes: string | null;
  wantedLanguages: string[];
  wantedFinishes: string[];
  wantedConditions: string[];
  wantedSets: string[];
};

interface CardFace {
  name: string;
  imageUris: CardImageUris | null;
}

interface ListRef {
  id: string;
  name: string;
  slug: string;
}

function readImage(value: unknown): CardImageUris | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const image: CardImageUris = {};
  for (const key of ['small', 'normal', 'large', 'png', 'art_crop', 'border_crop'] as const) {
    const url = record[key];
    if (typeof url === 'string' && url.length > 0) image[key] = url;
  }
  if (!image.normal && !image.small && !image.large && !image.png) return null;
  return image;
}

function toWantItem(row: WantRow, face: CardFace | undefined, lists: ListRef[]): WantItem {
  return {
    id: row.id,
    userId: row.userId,
    oracleId: row.oracleId,
    quantity: row.quantity,
    priority: (row.priority as WantPriority) ?? 2,
    notes: row.notes,
    wantedLanguages: (row.wantedLanguages ?? []) as WantItem['wantedLanguages'],
    wantedFinishes: (row.wantedFinishes ?? []) as WantItem['wantedFinishes'],
    wantedConditions: (row.wantedConditions ?? []) as WantItem['wantedConditions'],
    wantedSets: row.wantedSets ?? [],
    lists,
    ...(face?.name ? { cardName: face.name } : {}),
    ...(face?.imageUris ? { imageUris: face.imageUris } : {}),
  };
}

function oracleIdList(oracleIds: readonly string[]) {
  return sql.join(
    oracleIds.map((id) => sql`${id}`),
    sql`, `,
  );
}

async function cardFaces(
  db: Database,
  oracleIds: readonly string[],
): Promise<Map<string, CardFace>> {
  const unique = [...new Set(oracleIds)];
  if (unique.length === 0) return new Map();

  const pictured = (await db.execute(sql`
    SELECT DISTINCT ON (${cards.oracleId})
      ${cards.oracleId} AS "oracleId",
      ${cards.name} AS name,
      ${cards.imageUris} AS "imageUris"
    FROM ${cards}
    WHERE ${cards.oracleId} IN (${oracleIdList(unique)})
      AND ${cards.game} = ${CARD_GAME}
      AND ${cards.imageUris} IS NOT NULL
      AND ${cards.layout} IS DISTINCT FROM 'art_series'
    ORDER BY
      ${cards.oracleId},
      ${cards.releasedAt} ASC NULLS LAST,
      (${cards.lang} = 'en') DESC,
      ${cards.scryfallId}
  `)) as unknown as { oracleId: string; name: string; imageUris: unknown }[];

  const faces = new Map<string, CardFace>();
  for (const row of pictured) {
    if (!row.oracleId || !row.name) continue;
    faces.set(row.oracleId, { name: row.name, imageUris: readImage(row.imageUris) });
  }

  const missing = unique.filter((id) => !faces.has(id));
  if (missing.length === 0) return faces;

  const named = (await db.execute(sql`
    SELECT DISTINCT ON (${cards.oracleId})
      ${cards.oracleId} AS "oracleId",
      ${cards.name} AS name
    FROM ${cards}
    WHERE ${cards.oracleId} IN (${oracleIdList(missing)})
      AND ${cards.game} = ${CARD_GAME}
    ORDER BY
      ${cards.oracleId},
      (${cards.lang} = 'en') DESC,
      ${cards.scryfallId}
  `)) as unknown as { oracleId: string; name: string }[];

  for (const row of named) {
    if (!row.oracleId || !row.name || faces.has(row.oracleId)) continue;
    faces.set(row.oracleId, { name: row.name, imageUris: null });
  }
  return faces;
}

/** One query for every list label on a page of wants. */
async function listsForItems(
  db: Database,
  itemIds: string[],
  viewerId: string | undefined,
): Promise<Map<string, ListRef[]>> {
  const byItem = new Map<string, ListRef[]>();
  if (itemIds.length === 0 || !viewerId) return byItem;
  const rows = await db
    .select({
      itemId: wantListItems.wantItemId,
      id: wantLists.id,
      name: wantLists.name,
      slug: wantLists.slug,
    })
    .from(wantListItems)
    .innerJoin(wantLists, eq(wantLists.id, wantListItems.wantListId))
    .where(and(inArray(wantListItems.wantItemId, itemIds), eq(wantLists.userId, viewerId)))
    .orderBy(asc(wantLists.name));
  for (const row of rows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    byItem.set(row.itemId, list);
  }
  return byItem;
}

async function withFaces(
  db: Database,
  rows: WantRow[],
  viewerId: string | undefined,
): Promise<WantItem[]> {
  const ids = rows.map((row) => row.id);
  const [faces, lists] = await Promise.all([
    cardFaces(
      db,
      rows.map((row) => row.oracleId),
    ),
    listsForItems(db, ids, viewerId),
  ]);
  return rows.map((row) => toWantItem(row, faces.get(row.oracleId), lists.get(row.id) ?? []));
}

function normalizedScope(input: {
  wantedLanguages?: readonly string[];
  wantedFinishes?: readonly string[];
  wantedConditions?: readonly string[];
  wantedSets?: readonly string[];
}) {
  const sort = (values: readonly string[] | undefined, upper = false) =>
    [...new Set((values ?? []).map((value) => value.trim()))]
      .map((value) => (upper ? value.toUpperCase() : value.toLowerCase()))
      .sort();
  return {
    wantedLanguages: sort(input.wantedLanguages),
    wantedFinishes: sort(input.wantedFinishes),
    wantedConditions: sort(input.wantedConditions, true),
    wantedSets: sort(input.wantedSets),
  } as {
    wantedLanguages: string[];
    wantedFinishes: string[];
    wantedConditions: string[];
    wantedSets: string[];
  };
}

async function verifyLists(db: Database, userId: string, listIds: readonly string[]) {
  const unique = [...new Set(listIds)];
  if (unique.length === 0) return unique;
  const rows = await db
    .select({ id: wantLists.id })
    .from(wantLists)
    .where(and(eq(wantLists.userId, userId), inArray(wantLists.id, unique)));
  if (rows.length !== unique.length) {
    throw ApiError.badRequest('One of those lists is not yours.');
  }
  return unique;
}

export async function listWantItems(
  db: Database,
  listId: string,
  viewerId?: string,
): Promise<WantItem[]> {
  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .innerJoin(wantListItems, eq(wantListItems.wantItemId, wantItems.id))
    .where(eq(wantListItems.wantListId, listId))
    .orderBy(asc(wantItems.priority), asc(wantItems.createdAt));
  return withFaces(db, rows, viewerId);
}

export async function listAllWantItems(db: Database, userId: string): Promise<WantItem[]> {
  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .where(eq(wantItems.userId, userId))
    .orderBy(asc(wantItems.priority), asc(wantItems.createdAt));
  return withFaces(db, rows, userId);
}

export async function listCollectedWants(
  db: Database,
  userId: string,
  onlyPublic: boolean,
): Promise<WantItem[]> {
  if (!onlyPublic) return listAllWantItems(db, userId);

  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .innerJoin(wantListItems, eq(wantListItems.wantItemId, wantItems.id))
    .innerJoin(wantLists, eq(wantLists.id, wantListItems.wantListId))
    .where(and(eq(wantItems.userId, userId), eq(wantLists.visibility, 'public')))
    .groupBy(wantItems.id)
    .orderBy(asc(wantItems.priority), asc(wantItems.createdAt));
  return withFaces(db, rows, onlyPublic ? undefined : userId);
}

async function getWantItem(db: Database, userId: string, wantId: string): Promise<WantItem> {
  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .where(and(eq(wantItems.id, wantId), eq(wantItems.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Want not found');
  const [item] = await withFaces(db, [row], userId);
  if (!item) throw ApiError.notFound('Want not found');
  return item;
}

async function insertMemberships(
  db: Database,
  userId: string,
  wantId: string,
  listIds: readonly string[],
): Promise<void> {
  if (listIds.length === 0) return;
  await db
    .insert(wantListItems)
    .values(listIds.map((wantListId) => ({ wantListId, wantItemId: wantId, userId })))
    .onConflictDoNothing();
}

export async function addWantItem(
  db: Database,
  userId: string,
  input: AddWantItemInput,
): Promise<WantItem> {
  const listIds = await verifyLists(db, userId, input.listIds);
  const scope = normalizedScope(input);
  const scopeKey = wantScopeKey(scope);

  const known = await db
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(and(eq(cards.oracleId, input.oracleId), eq(cards.game, CARD_GAME)))
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
      ...scope,
      scopeKey,
    })
    .onConflictDoUpdate({
      target: [wantItems.userId, wantItems.oracleId, wantItems.scopeKey],
      set: {
        quantity: sql`${wantItems.quantity} + excluded.quantity`,
        priority: sql`least(${wantItems.priority}, excluded.priority)`,
        notes: sql`coalesce(${wantItems.notes}, excluded.notes)`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: wantItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the want');
  await insertMemberships(db, userId, id, listIds);
  return getWantItem(db, userId, id);
}

export async function updateWantItem(
  db: Database,
  userId: string,
  wantId: string,
  input: UpdateWantItemInput,
): Promise<WantItem> {
  const current = await db
    .select(wantSelection)
    .from(wantItems)
    .where(and(eq(wantItems.id, wantId), eq(wantItems.userId, userId)))
    .limit(1);
  const row = current[0];
  if (!row) throw ApiError.notFound('Want not found');

  const listIds =
    input.listIds === undefined ? undefined : await verifyLists(db, userId, input.listIds);
  const nextScope =
    input.wantedLanguages !== undefined ||
    input.wantedFinishes !== undefined ||
    input.wantedConditions !== undefined ||
    input.wantedSets !== undefined
      ? normalizedScope({
          wantedLanguages: input.wantedLanguages ?? row.wantedLanguages,
          wantedFinishes: input.wantedFinishes ?? row.wantedFinishes,
          wantedConditions: input.wantedConditions ?? row.wantedConditions,
          wantedSets: input.wantedSets ?? row.wantedSets,
        })
      : null;
  const nextScopeKey = nextScope ? wantScopeKey(nextScope) : null;

  if (nextScopeKey && nextScopeKey !== wantScopeKey(row)) {
    const clash = await db
      .select({ id: wantItems.id, quantity: wantItems.quantity, priority: wantItems.priority })
      .from(wantItems)
      .where(
        and(
          eq(wantItems.userId, userId),
          eq(wantItems.oracleId, row.oracleId),
          eq(wantItems.scopeKey, nextScopeKey),
          ne(wantItems.id, wantId),
        ),
      )
      .limit(1);
    const target = clash[0];
    if (target) {
      await db.transaction(async (tx) => {
        await tx
          .update(wantItems)
          .set({
            quantity: target.quantity + row.quantity,
            priority: Math.min(target.priority, input.priority ?? row.priority),
            notes: input.notes ?? row.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(wantItems.id, target.id));
        const existingMemberships = await tx
          .select({ wantListId: wantListItems.wantListId, userId: wantListItems.userId })
          .from(wantListItems)
          .where(eq(wantListItems.wantItemId, wantId));
        if (existingMemberships.length > 0) {
          await tx
            .insert(wantListItems)
            .values(
              existingMemberships.map((membership) => ({
                wantListId: membership.wantListId,
                wantItemId: target.id,
                userId: membership.userId,
              })),
            )
            .onConflictDoNothing();
        }
        await tx.delete(wantItems).where(eq(wantItems.id, wantId));
      });
      return getWantItem(db, userId, target.id);
    }
  }

  await db
    .update(wantItems)
    .set({
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(nextScope ?? {}),
      ...(nextScopeKey ? { scopeKey: nextScopeKey } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(wantItems.id, wantId), eq(wantItems.userId, userId)));

  if (listIds !== undefined) {
    await db.delete(wantListItems).where(eq(wantListItems.wantItemId, wantId));
    await insertMemberships(db, userId, wantId, listIds);
  }
  return getWantItem(db, userId, wantId);
}

export async function removeWantItem(db: Database, userId: string, wantId: string): Promise<void> {
  const removed = await db
    .delete(wantItems)
    .where(and(eq(wantItems.id, wantId), eq(wantItems.userId, userId)))
    .returning({ id: wantItems.id });
  if (!removed[0]) throw ApiError.notFound('Want not found');
}

export async function removeWantFromList(
  db: Database,
  userId: string,
  listId: string,
  wantId: string,
): Promise<void> {
  await ownedList(db, userId, listId);
  await db
    .delete(wantListItems)
    .where(
      and(
        eq(wantListItems.wantListId, listId),
        eq(wantListItems.wantItemId, wantId),
        eq(wantListItems.userId, userId),
      ),
    );
}
