import type { Database } from '@opulent/db';
import { cardGroups, cards, collectionItems, groupMemberships } from '@opulent/db';
import type {
  AddCollectionItemInput,
  CollectionItem,
  Page,
  SplitCollectionItemInput,
  UpdateCollectionItemInput,
} from '@opulent/shared';
import { cardLanguageOrEnglish } from '@opulent/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  assertPaperPrinting,
  assertPrintedLanguage,
  listLanguagePrintings,
} from '../cards/service';
import { ApiError } from '../../lib/http';
import { errorText, log } from '../../lib/log';
import { snapshotUserValue } from './value';
import {
  collectionItemFilters,
  decodeCursor,
  encodeCursor,
  loadGroupsForItems,
  pageOfItems,
  priceColumns,
  selectCollectionItems,
  toCollectionItem,
  type CollectionItemListQuery,
} from './rows';

export async function listCollectionItems(
  db: Database,
  userId: string,
  pagination: CollectionItemListQuery,
): Promise<Page<CollectionItem>> {
  return pageOfItems(db, eq(collectionItems.userId, userId), pagination, userId, true);
}

/** Group contents; only the owner reaches this through the groups module. */
export async function listItemsInGroup(
  db: Database,
  groupId: string,
  pagination: CollectionItemListQuery,
): Promise<Page<CollectionItem>> {
  const after = decodeCursor(pagination.cursor);
  const rows = await selectCollectionItems(db)
    .innerJoin(
      groupMemberships,
      and(eq(groupMemberships.itemId, collectionItems.id), eq(groupMemberships.groupId, groupId)),
    )
    .where(
      and(
        after
          ? sql`(${cards.name}, ${collectionItems.id}) > (${after.name}, ${after.id}::uuid)`
          : undefined,
        ...collectionItemFilters(pagination, undefined),
      ),
    )
    .orderBy(asc(cards.name), asc(collectionItems.id))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const page = hasMore ? rows.slice(0, pagination.limit) : rows;
  const last = page[page.length - 1];

  const items = page.map((row) => toCollectionItem(row, []));
  const groups = await loadGroupsForItems(
    db,
    items.map((item) => item.id),
  );
  for (const item of items) item.groups = groups.get(item.id) ?? [];

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.cardName, last.id) : null,
  };
}

export type CollectionItemInput = Omit<
  AddCollectionItemInput,
  'signed' | 'altered' | 'misprint' | 'miscut' | 'artistProof'
> &
  Partial<
    Pick<AddCollectionItemInput, 'signed' | 'altered' | 'misprint' | 'miscut' | 'artistProof'>
  >;

/** A snapshot failure must not fail the card change; the daily job catches up. */
async function refreshTodayValue(db: Database, userId: string): Promise<void> {
  try {
    await snapshotUserValue(db, userId);
  } catch (error) {
    log.error({ message: errorText(error) }, 'collection value snapshot failed');
  }
}

/** Adds a card or bumps the exact stack; price is not part of the stack key. */
export async function addCollectionItem(
  db: Database,
  userId: string,
  input: CollectionItemInput,
): Promise<CollectionItem> {
  await assertPaperPrinting(db, input.scryfallId);
  await assertPrintedLanguage(db, input.scryfallId, input.language);

  const groupIds = Array.from(new Set(input.groupIds ?? []));
  if (groupIds.length > 0) {
    const owned = await db
      .select({ id: cardGroups.id })
      .from(cardGroups)
      .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
    if (owned.length !== groupIds.length) {
      throw ApiError.badRequest('One of those groups is not yours');
    }
  }

  const inserted = await db
    .insert(collectionItems)
    .values({
      userId,
      scryfallId: input.scryfallId,
      quantity: input.quantity,
      finish: input.finish,
      condition: input.condition,
      language: input.language,
      signed: input.signed ?? false,
      altered: input.altered ?? false,
      misprint: input.misprint ?? false,
      miscut: input.miscut ?? false,
      artistProof: input.artistProof ?? false,
      notes: input.notes ?? null,
      photoUrl: input.photoUrl ?? null,
      forTrade: input.forTrade,
      ...priceColumns(input.price),
    })
    .onConflictDoUpdate({
      target: [
        collectionItems.userId,
        collectionItems.scryfallId,
        collectionItems.finish,
        collectionItems.condition,
        collectionItems.language,
        collectionItems.signed,
        collectionItems.altered,
        collectionItems.misprint,
        collectionItems.miscut,
        collectionItems.artistProof,
      ],
      set: {
        quantity: sql`${collectionItems.quantity} + ${input.quantity}`,
        // Do not overwrite an existing owner price; edit the stack to change it.
        forTrade: sql`${collectionItems.forTrade} OR excluded.for_trade`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: collectionItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the card');

  if (groupIds.length > 0) {
    await db
      .insert(groupMemberships)
      .values(groupIds.map((groupId) => ({ itemId: id, groupId, userId })))
      .onConflictDoNothing();
  }

  const rows = await selectCollectionItems(db).where(eq(collectionItems.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('internal_error', 'Could not read back the added card');
  const groups = await loadGroupsForItems(db, [id]);
  await refreshTodayValue(db, userId);
  return toCollectionItem(row, groups.get(id) ?? []);
}

export async function getCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<CollectionItem> {
  const rows = await selectCollectionItems(db)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in your collection');
  const groups = await loadGroupsForItems(db, [itemId]);
  return toCollectionItem(row, groups.get(itemId) ?? []);
}

export async function updateCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
  input: UpdateCollectionItemInput,
): Promise<CollectionItem> {
  const patch: Partial<typeof collectionItems.$inferInsert> = { updatedAt: new Date() };
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.finish !== undefined) patch.finish = input.finish;
  if (input.condition !== undefined) patch.condition = input.condition;
  if (input.language !== undefined) {
    const existing = await db
      .select({ scryfallId: collectionItems.scryfallId })
      .from(collectionItems)
      .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
      .limit(1);
    const scryfallId = existing[0]?.scryfallId;
    if (!scryfallId) throw ApiError.notFound('Card not found in your collection');
    await assertPrintedLanguage(db, scryfallId, input.language);
    // A language change moves to that language's printing, which has its own Scryfall id.
    const printings = await listLanguagePrintings(db, scryfallId);
    const nextPrinting = printings.find(
      (card) => cardLanguageOrEnglish(card.lang) === input.language,
    );
    if (!nextPrinting) {
      throw ApiError.badRequest('This card was not printed in that language.');
    }
    patch.language = input.language;
    patch.scryfallId = nextPrinting.scryfallId;
  }
  if (input.signed !== undefined) patch.signed = input.signed;
  if (input.altered !== undefined) patch.altered = input.altered;
  if (input.misprint !== undefined) patch.misprint = input.misprint;
  if (input.miscut !== undefined) patch.miscut = input.miscut;
  if (input.artistProof !== undefined) patch.artistProof = input.artistProof;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.photoUrl !== undefined) patch.photoUrl = input.photoUrl;
  if (input.forTrade !== undefined) patch.forTrade = input.forTrade;
  if (input.price) Object.assign(patch, priceColumns(input.price));

  try {
    const updated = await db
      .update(collectionItems)
      .set(patch)
      .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
      .returning({ id: collectionItems.id });

    if (!updated[0]) throw ApiError.notFound('Card not found in your collection');
  } catch (error) {
    if (isStackCollision(error)) {
      throw ApiError.conflict(
        'You already have a stack of this card with those details. Add to that stack instead.',
      );
    }
    throw error;
  }

  if (input.groupIds !== undefined) {
    const groupIds = [...new Set(input.groupIds)];
    if (groupIds.length > 0) {
      const owned = await db
        .select({ id: cardGroups.id })
        .from(cardGroups)
        .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
      if (owned.length !== groupIds.length) {
        throw ApiError.badRequest('One of those groups is not yours.');
      }
    }
    await db.delete(groupMemberships).where(eq(groupMemberships.itemId, itemId));
    if (groupIds.length > 0) {
      await db
        .insert(groupMemberships)
        .values(groupIds.map((groupId) => ({ itemId, groupId, userId })))
        .onConflictDoNothing();
    }
  }

  const rows = await selectCollectionItems(db).where(eq(collectionItems.id, itemId)).limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in your collection');
  const groups = await loadGroupsForItems(db, [itemId]);
  await refreshTodayValue(db, userId);
  return toCollectionItem(row, groups.get(itemId) ?? []);
}

/** Splits one copy into a new stack; an existing matching stack absorbs it and the original loses one. */
export async function splitCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
  input: SplitCollectionItemInput,
): Promise<void> {
  const rows = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .limit(1);
  const current = rows[0];
  if (!current) throw ApiError.notFound('Card not found in your collection');
  if (current.quantity <= 1) {
    throw ApiError.badRequest('This stack has only one copy. Edit the whole stack instead.');
  }

  let scryfallId = current.scryfallId;
  const language = (input.language ?? current.language) as NonNullable<
    SplitCollectionItemInput['language']
  >;
  if (language !== current.language) {
    await assertPrintedLanguage(db, current.scryfallId, language);
    const printings = await listLanguagePrintings(db, current.scryfallId);
    const next = printings.find((card) => cardLanguageOrEnglish(card.lang) === language);
    if (!next) throw ApiError.badRequest('This card was not printed in that language.');
    scryfallId = next.scryfallId;
  }

  const groupIds =
    input.groupIds !== undefined
      ? [...new Set(input.groupIds)]
      : (
          await db
            .select({ groupId: groupMemberships.groupId })
            .from(groupMemberships)
            .where(eq(groupMemberships.itemId, itemId))
        ).map((row) => row.groupId);

  if (input.groupIds !== undefined && groupIds.length > 0) {
    const owned = await db
      .select({ id: cardGroups.id })
      .from(cardGroups)
      .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
    if (owned.length !== groupIds.length) {
      throw ApiError.badRequest('One of those groups is not yours.');
    }
  }

  const sameStack =
    scryfallId === current.scryfallId &&
    (input.finish ?? current.finish) === current.finish &&
    (input.condition ?? current.condition) === current.condition &&
    language === current.language &&
    (input.signed ?? current.signed) === current.signed &&
    (input.altered ?? current.altered) === current.altered &&
    (input.misprint ?? current.misprint) === current.misprint &&
    (input.miscut ?? current.miscut) === current.miscut &&
    (input.artistProof ?? current.artistProof) === current.artistProof;
  if (sameStack) {
    throw ApiError.badRequest(
      'Change the finish, condition, language, or a mark to split off one copy.',
    );
  }

  const price = input.price
    ? priceColumns(input.price)
    : {
        priceKind: current.priceKind,
        pricePercent: current.pricePercent,
        priceAmount: current.priceAmount,
      };

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(collectionItems)
      .values({
        userId,
        scryfallId,
        quantity: 1,
        finish: input.finish ?? current.finish,
        condition: input.condition ?? current.condition,
        language,
        signed: input.signed ?? current.signed,
        altered: input.altered ?? current.altered,
        misprint: input.misprint ?? current.misprint,
        miscut: input.miscut ?? current.miscut,
        artistProof: input.artistProof ?? current.artistProof,
        notes: input.notes !== undefined ? input.notes : current.notes,
        photoUrl: input.photoUrl !== undefined ? input.photoUrl : current.photoUrl,
        forTrade: input.forTrade ?? current.forTrade,
        ...price,
      })
      .onConflictDoUpdate({
        target: [
          collectionItems.userId,
          collectionItems.scryfallId,
          collectionItems.finish,
          collectionItems.condition,
          collectionItems.language,
          collectionItems.signed,
          collectionItems.altered,
          collectionItems.misprint,
          collectionItems.miscut,
          collectionItems.artistProof,
        ],
        set: {
          quantity: sql`${collectionItems.quantity} + 1`,
          forTrade: sql`${collectionItems.forTrade} OR excluded.for_trade`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: collectionItems.id });

    const newId = inserted[0]?.id;
    if (!newId) throw new ApiError('internal_error', 'Could not split the stack');

    const changed = await tx
      .update(collectionItems)
      .set({
        quantity: sql`${collectionItems.quantity} - 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(collectionItems.id, itemId),
          eq(collectionItems.userId, userId),
          sql`${collectionItems.quantity} > 1`,
        ),
      )
      .returning({ id: collectionItems.id });
    if (!changed[0]) {
      throw ApiError.conflict('That stack changed before the split. Try again.');
    }

    if (groupIds.length > 0) {
      await tx
        .insert(groupMemberships)
        .values(groupIds.map((groupId) => ({ itemId: newId, groupId, userId })))
        .onConflictDoNothing();
    }
  });

  await refreshTodayValue(db, userId);
}

/** Postgres reports a broken unique index as SQLSTATE 23505. */
function isStackCollision(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'collection_items_stack_key';
  });
}

export async function removeCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<void> {
  await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)));
  await refreshTodayValue(db, userId);
}
