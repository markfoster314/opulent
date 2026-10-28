import type { Database, WantListRow } from '@opulent/db';
import { cards, genericWants, users, wantItems, wantListItems, wantLists } from '@opulent/db';
import type {
  AddWantItemInput,
  CardImageUris,
  CardSet,
  CreateGenericWantInput,
  CreateWantListInput,
  GenericMatchOwner,
  GenericWant,
  UpdateWantItemInput,
  UpdateWantListInput,
  WantItem,
  WantList,
  WantPriority,
} from '@opulent/shared';
import { CARD_GAME, genericWantMatchKey, wantScopeKey } from '@opulent/shared';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { ApiError, slugify } from '../../lib/http';

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

async function ownedList(db: Database, userId: string, listId: string) {
  const rows = await db
    .select()
    .from(wantLists)
    .where(and(eq(wantLists.id, listId), eq(wantLists.userId, userId)))
    .limit(1);
  const list = rows[0];
  if (!list) throw ApiError.notFound('Want list not found');
  return list;
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

function isDuplicateGenericWant(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'generic_wants_user_match_key';
  });
}

async function namesForSets(
  db: Database,
  codes: readonly string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(codes)];
  const names = new Map<string, string | null>();
  if (unique.length === 0) return names;

  const rows = (await db.execute(sql`
    SELECT
      ${cards.setCode} AS "setCode",
      max(${cards.setName}) AS "setName"
    FROM ${cards}
    WHERE ${cards.game} = ${CARD_GAME}
      AND ${cards.setCode} IN (${sql.join(
        unique.map((code) => sql`${code}`),
        sql`, `,
      )})
    GROUP BY ${cards.setCode}
  `)) as unknown as { setCode: string; setName: string | null }[];

  for (const row of rows) names.set(row.setCode, row.setName);
  return names;
}

function toGenericWant(
  row: {
    id: string;
    userId: string;
    languages: string[];
    finishes: string[];
    conditions: string[];
    sets: string[];
    signed: boolean;
    altered: boolean;
    misprint: boolean;
    miscut: boolean;
    artistProof: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  setNames: Map<string, string | null>,
): GenericWant {
  return {
    id: row.id,
    userId: row.userId,
    languages: row.languages as GenericWant['languages'],
    finishes: row.finishes as GenericWant['finishes'],
    conditions: row.conditions as GenericWant['conditions'],
    sets: row.sets.map((setCode): CardSet => ({ setCode, setName: setNames.get(setCode) ?? null })),
    signed: row.signed,
    altered: row.altered,
    misprint: row.misprint,
    miscut: row.miscut,
    artistProof: row.artistProof,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listGenericWants(db: Database, userId: string): Promise<GenericWant[]> {
  const rows = await db
    .select()
    .from(genericWants)
    .where(eq(genericWants.userId, userId))
    .orderBy(desc(genericWants.createdAt));

  const setNames = await namesForSets(
    db,
    rows.flatMap((row) => row.sets),
  );
  return rows.map((row) => toGenericWant(row, setNames));
}

export async function createGenericWant(
  db: Database,
  userId: string,
  input: CreateGenericWantInput,
): Promise<GenericWant> {
  const setNames = await namesForSets(db, input.sets);
  const missing = input.sets.filter((code) => !setNames.has(code));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Unknown set: ${missing.map((code) => code.toUpperCase()).join(', ')}`,
    );
  }

  try {
    const inserted = await db
      .insert(genericWants)
      .values({
        userId,
        languages: [...input.languages],
        finishes: [...input.finishes],
        conditions: [...input.conditions],
        sets: [...input.sets],
        signed: input.signed,
        altered: input.altered,
        misprint: input.misprint,
        miscut: input.miscut,
        artistProof: input.artistProof,
        matchKey: genericWantMatchKey(input),
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new ApiError('internal_error', 'Could not save that interest');
    return toGenericWant(row, setNames);
  } catch (error) {
    if (isDuplicateGenericWant(error)) {
      throw ApiError.conflict('You already saved that mix of choices.');
    }
    throw error;
  }
}

export async function removeGenericWant(
  db: Database,
  userId: string,
  wantId: string,
): Promise<void> {
  const removed = await db
    .delete(genericWants)
    .where(and(eq(genericWants.id, wantId), eq(genericWants.userId, userId)))
    .returning({ id: genericWants.id });
  if (!removed[0]) throw ApiError.notFound('Generic want not found');
}

/** Generic matches; each fitting stack counts once, and results are capped per owner. */
export async function findGenericMatchOwners(
  db: Database,
  viewerId: string,
  limit: number,
): Promise<GenericMatchOwner[]> {
  const rows = (await db.execute(sql`
    WITH viewer AS (
      SELECT p.location
      FROM users u
      LEFT JOIN places p ON p.geoname_id = u.place_id
      WHERE u.id = ${viewerId}
    ),
    hits AS (
      SELECT
        bi.user_id AS owner_id,
        bi.id AS item_id,
        min(c.name) AS card_name,
        min(c.set_code) AS set_code,
        (array_agg(c.image_uris))[1] AS image_uris,
        min(bi.finish::text) AS finish,
        min(bi.condition::text) AS condition,
        min(c.lang) AS lang,
        sum(bi.quantity)::int AS quantity
      FROM generic_wants gw
      JOIN collection_items bi ON bi.for_trade = true AND bi.user_id <> ${viewerId}
      JOIN cards c ON c.scryfall_id = bi.scryfall_id
      WHERE gw.user_id = ${viewerId}
        AND c.game = ${CARD_GAME}
        AND (cardinality(gw.languages) = 0 OR c.lang = ANY(gw.languages))
        AND (cardinality(gw.finishes) = 0 OR bi.finish::text = ANY(gw.finishes))
        AND (cardinality(gw.conditions) = 0 OR bi.condition::text = ANY(gw.conditions))
        AND (cardinality(gw.sets) = 0 OR lower(c.set_code) = ANY(gw.sets))
        AND (NOT gw.signed OR bi.signed)
        AND (NOT gw.altered OR bi.altered)
        AND (NOT gw.misprint OR bi.misprint)
        AND (NOT gw.miscut OR bi.miscut)
        AND (NOT gw.artist_proof OR bi.artist_proof)
      GROUP BY bi.user_id, bi.id
    ),
    grouped AS (
      SELECT
        owner_id,
        count(*)::int AS match_count,
        jsonb_agg(
          jsonb_build_object(
            'name', card_name,
            'setCode', set_code,
            'imageUris', image_uris,
            'finish', finish,
            'condition', condition,
            'language', lang,
            'quantity', quantity
          )
          ORDER BY card_name
        ) AS cards
      FROM hits
      GROUP BY owner_id
    )
    SELECT
      u.username,
      p.label AS city,
      CASE
        WHEN p.location IS NULL OR viewer.location IS NULL THEN NULL
        ELSE ST_Distance(p.location, viewer.location)
      END AS "distanceMeters",
      g.match_count AS "matchCount",
      g.cards
    FROM grouped g
    JOIN users u ON u.id = g.owner_id
    LEFT JOIN places p ON p.geoname_id = u.place_id
    CROSS JOIN viewer
    WHERE u.trade_binder_visibility = 'public'
      AND u.onboarded_at IS NOT NULL
    ORDER BY "distanceMeters" ASC NULLS LAST, g.match_count DESC, u.username ASC
    LIMIT ${limit}
  `)) as unknown as {
    username: string;
    city: string | null;
    distanceMeters: number | string | null;
    matchCount: number | string;
    cards: GenericMatchOwner['cards'];
  }[];

  return rows.map((row) => ({
    username: row.username,
    city: row.city,
    distanceMeters: row.distanceMeters === null ? null : Math.round(Number(row.distanceMeters)),
    matchCount: Number(row.matchCount),
    cards: (row.cards ?? []).slice(0, 4),
  }));
}
