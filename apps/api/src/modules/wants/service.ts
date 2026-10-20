import type { Database, WantListRow } from '@opulent/db';
import { cards, genericWants, users, wantItems, wantLists } from '@opulent/db';
import type {
  AddWantItemInput,
  CardImageUris,
  CardSet,
  CreateGenericWantInput,
  CreateWantListInput,
  GenericWant,
  UpdateWantItemInput,
  UpdateWantListInput,
  WantItem,
  WantList,
  WantPriority,
} from '@opulent/shared';
import { genericWantMatchKey, wantScopeError } from '@opulent/shared';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { ApiError, slugify } from '../../lib/http';

const scopeColumns = {
  wantedLanguages: wantItems.wantedLanguages,
  unwantedLanguages: wantItems.unwantedLanguages,
  wantedFinishes: wantItems.wantedFinishes,
  unwantedFinishes: wantItems.unwantedFinishes,
  wantedConditions: wantItems.wantedConditions,
  unwantedConditions: wantItems.unwantedConditions,
  wantedSets: wantItems.wantedSets,
  unwantedSets: wantItems.unwantedSets,
};

const wantSelection = {
  id: wantItems.id,
  wantListId: wantItems.wantListId,
  userId: wantItems.userId,
  oracleId: wantItems.oracleId,
  quantity: wantItems.quantity,
  priority: wantItems.priority,
  notes: wantItems.notes,
  ...scopeColumns,
};

type WantRow = {
  id: string;
  wantListId: string;
  userId: string;
  oracleId: string;
  quantity: number;
  priority: number;
  notes: string | null;
  wantedLanguages: string[];
  unwantedLanguages: string[];
  wantedFinishes: string[];
  unwantedFinishes: string[];
  wantedConditions: string[];
  unwantedConditions: string[];
  wantedSets: string[];
  unwantedSets: string[];
};

interface CardFace {
  name: string;
  imageUris: CardImageUris | null;
}

/** Keeps only real picture links. A bad or empty scan is treated as no picture. */
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

function toWantItem(row: WantRow, face: CardFace | undefined): WantItem {
  return {
    id: row.id,
    wantListId: row.wantListId,
    userId: row.userId,
    oracleId: row.oracleId,
    quantity: row.quantity,
    priority: (row.priority as WantPriority) ?? 2,
    notes: row.notes,
    wantedLanguages: (row.wantedLanguages ?? []) as WantItem['wantedLanguages'],
    unwantedLanguages: (row.unwantedLanguages ?? []) as WantItem['unwantedLanguages'],
    wantedFinishes: (row.wantedFinishes ?? []) as WantItem['wantedFinishes'],
    unwantedFinishes: (row.unwantedFinishes ?? []) as WantItem['unwantedFinishes'],
    wantedConditions: (row.wantedConditions ?? []) as WantItem['wantedConditions'],
    unwantedConditions: (row.unwantedConditions ?? []) as WantItem['unwantedConditions'],
    wantedSets: row.wantedSets ?? [],
    unwantedSets: row.unwantedSets ?? [],
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

/**
 * The name and oldest picture for each card on the list.
 *
 * The name is read from the same card row as the picture, so the title is the
 * card the owner picked. A card with no picture still gets its name.
 */
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

async function withFaces(db: Database, rows: WantRow[]): Promise<WantItem[]> {
  const faces = await cardFaces(
    db,
    rows.map((row) => row.oracleId),
  );
  return rows.map((row) => toWantItem(row, faces.get(row.oracleId)));
}

function scopeValues(input: AddWantItemInput | UpdateWantItemInput) {
  return {
    ...(input.wantedLanguages !== undefined ? { wantedLanguages: input.wantedLanguages } : {}),
    ...(input.unwantedLanguages !== undefined
      ? { unwantedLanguages: input.unwantedLanguages }
      : {}),
    ...(input.wantedFinishes !== undefined ? { wantedFinishes: input.wantedFinishes } : {}),
    ...(input.unwantedFinishes !== undefined ? { unwantedFinishes: input.unwantedFinishes } : {}),
    ...(input.wantedConditions !== undefined ? { wantedConditions: input.wantedConditions } : {}),
    ...(input.unwantedConditions !== undefined
      ? { unwantedConditions: input.unwantedConditions }
      : {}),
    ...(input.wantedSets !== undefined ? { wantedSets: input.wantedSets } : {}),
    ...(input.unwantedSets !== undefined ? { unwantedSets: input.unwantedSets } : {}),
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

async function itemCountFor(db: Database, listId: string): Promise<number> {
  const counts = await db
    .select({ itemCount: sql<number>`coalesce(sum(${wantItems.quantity}), 0)::int` })
    .from(wantItems)
    .where(eq(wantItems.wantListId, listId));
  return Number(counts[0]?.itemCount ?? 0);
}

/**
 * The share token stays with the owner. A stranger who opens a public list
 * must not learn a token that would still work if the list later becomes unlisted.
 */
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

/** You own it, it is public, or you hold the unlisted token. */
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
        id: wantItems.wantListId,
        itemCount: sql<number>`coalesce(sum(${wantItems.quantity}), 0)::int`,
      })
      .from(wantItems)
      .where(
        inArray(
          wantItems.wantListId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(wantItems.wantListId);
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

/** Wire shape for a list opened from a share link. The token stays with the owner. */
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

/** Invalidates every share link handed out so far. */
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

export async function listWantItems(db: Database, listId: string): Promise<WantItem[]> {
  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .where(eq(wantItems.wantListId, listId))
    .orderBy(asc(wantItems.priority), asc(wantItems.createdAt));
  return withFaces(db, rows);
}

/** Every want across this person's lists. Public skips private and unlisted lists. */
export async function listCollectedWants(
  db: Database,
  userId: string,
  onlyPublic: boolean,
): Promise<WantItem[]> {
  const scope = onlyPublic
    ? and(eq(wantItems.userId, userId), eq(wantLists.visibility, 'public'))
    : eq(wantItems.userId, userId);
  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .innerJoin(wantLists, eq(wantLists.id, wantItems.wantListId))
    .where(scope)
    .orderBy(asc(wantItems.priority), asc(wantItems.createdAt));
  return withFaces(db, rows);
}

/** Adding a card already on the list raises the quantity and saves the new choices. */
export async function addWantItem(
  db: Database,
  userId: string,
  listId: string,
  input: AddWantItemInput,
): Promise<WantItem> {
  await ownedList(db, userId, listId);
  const scopeMessage = wantScopeError(input);
  if (scopeMessage) throw ApiError.badRequest(scopeMessage);

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
      wantListId: listId,
      userId,
      oracleId: input.oracleId,
      quantity: input.quantity,
      priority: input.priority,
      notes: input.notes ?? null,
      wantedLanguages: input.wantedLanguages,
      unwantedLanguages: input.unwantedLanguages,
      wantedFinishes: input.wantedFinishes,
      unwantedFinishes: input.unwantedFinishes,
      wantedConditions: input.wantedConditions,
      unwantedConditions: input.unwantedConditions,
      wantedSets: input.wantedSets,
      unwantedSets: input.unwantedSets,
    })
    .onConflictDoUpdate({
      target: [wantItems.wantListId, wantItems.oracleId],
      set: {
        quantity: sql`${wantItems.quantity} + ${input.quantity}`,
        priority: input.priority,
        ...scopeValues(input),
        updatedAt: new Date(),
      },
    })
    .returning({ id: wantItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the want');

  const rows = await db.select(wantSelection).from(wantItems).where(eq(wantItems.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('internal_error', 'Could not read back the want');
  const [item] = await withFaces(db, [row]);
  if (!item) throw new ApiError('internal_error', 'Could not read back the want');
  return item;
}

export async function updateWantItem(
  db: Database,
  userId: string,
  listId: string,
  wantId: string,
  input: UpdateWantItemInput,
): Promise<WantItem> {
  await ownedList(db, userId, listId);
  const updated = await db
    .update(wantItems)
    .set({
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...scopeValues(input),
      updatedAt: new Date(),
    })
    .where(
      and(eq(wantItems.id, wantId), eq(wantItems.wantListId, listId), eq(wantItems.userId, userId)),
    )
    .returning({ id: wantItems.id });

  if (!updated[0]) throw ApiError.notFound('Want not found');

  const rows = await db
    .select(wantSelection)
    .from(wantItems)
    .where(eq(wantItems.id, wantId))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Want not found');
  const [item] = await withFaces(db, [row]);
  if (!item) throw ApiError.notFound('Want not found');
  return item;
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
    WHERE ${cards.setCode} IN (${sql.join(
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

export async function removeWantItem(
  db: Database,
  userId: string,
  listId: string,
  wantId: string,
): Promise<void> {
  await ownedList(db, userId, listId);
  await db
    .delete(wantItems)
    .where(
      and(eq(wantItems.id, wantId), eq(wantItems.wantListId, listId), eq(wantItems.userId, userId)),
    );
}
