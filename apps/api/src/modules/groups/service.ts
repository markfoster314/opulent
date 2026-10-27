import type { CardGroupRow, Database } from '@opulent/db';
import { cardGroups, collectionItems, groupMemberships } from '@opulent/db';
import type {
  CardGroup,
  CollectionItem,
  CollectionItemQuery,
  CreateCardGroupInput,
  Page,
  UpdateCardGroupInput,
} from '@opulent/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { listItemsInGroup } from '../collection/service';

type GroupItemQuery = Partial<CollectionItemQuery> & { limit: number };

function toCardGroup(row: CardGroupRow, itemCount: number): CardGroup {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Every group this person owns, with the number of stacks in each.
 *
 * A group is a label, so an empty group is still a group. Counting through the
 * membership join keeps the list to one query.
 */
export async function listGroupsForOwner(db: Database, userId: string): Promise<CardGroup[]> {
  const rows = await db
    .select({
      id: cardGroups.id,
      userId: cardGroups.userId,
      name: cardGroups.name,
      description: cardGroups.description,
      createdAt: cardGroups.createdAt,
      updatedAt: cardGroups.updatedAt,
      itemCount: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)::int`,
    })
    .from(cardGroups)
    .leftJoin(groupMemberships, eq(groupMemberships.groupId, cardGroups.id))
    .leftJoin(collectionItems, eq(collectionItems.id, groupMemberships.itemId))
    .where(eq(cardGroups.userId, userId))
    .groupBy(cardGroups.id)
    .orderBy(asc(cardGroups.name));

  return rows.map((row) => toCardGroup(row, Number(row.itemCount)));
}

/** Groups are private, so a group that is not yours reports "not found". */
export async function getGroupForOwner(
  db: Database,
  userId: string,
  groupId: string,
): Promise<CardGroup> {
  const rows = await db
    .select()
    .from(cardGroups)
    .where(and(eq(cardGroups.id, groupId), eq(cardGroups.userId, userId)))
    .limit(1);
  const group = rows[0];
  if (!group) throw ApiError.notFound('Group not found');

  const counted = await db
    .select({ itemCount: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)::int` })
    .from(groupMemberships)
    .innerJoin(collectionItems, eq(collectionItems.id, groupMemberships.itemId))
    .where(eq(groupMemberships.groupId, groupId));

  return toCardGroup(group, Number(counted[0]?.itemCount ?? 0));
}

/** Two groups of one person cannot share a name, ignoring case. */
function isGroupNameTaken(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'card_groups_user_name_key';
  });
}

export async function createGroup(
  db: Database,
  userId: string,
  input: CreateCardGroupInput,
): Promise<CardGroup> {
  try {
    const inserted = await db
      .insert(cardGroups)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
      })
      .returning();
    const group = inserted[0];
    if (!group) throw new ApiError('internal_error', 'Could not create the group');
    return toCardGroup(group, 0);
  } catch (error) {
    if (isGroupNameTaken(error)) {
      throw ApiError.conflict(`You already have a group named "${input.name}"`);
    }
    throw error;
  }
}

export async function updateGroup(
  db: Database,
  userId: string,
  groupId: string,
  input: UpdateCardGroupInput,
): Promise<CardGroup> {
  await getGroupForOwner(db, userId, groupId);
  try {
    const updated = await db
      .update(cardGroups)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(cardGroups.id, groupId), eq(cardGroups.userId, userId)))
      .returning();
    if (updated.length === 0) throw ApiError.notFound('Group not found');
    return getGroupForOwner(db, userId, groupId);
  } catch (error) {
    if (isGroupNameTaken(error)) {
      throw ApiError.conflict(`You already have a group named "${input.name ?? ''}"`);
    }
    throw error;
  }
}

/** Deleting a group removes its labels, never the cards. */
export async function deleteGroup(db: Database, userId: string, groupId: string): Promise<void> {
  await getGroupForOwner(db, userId, groupId);
  await db.delete(cardGroups).where(and(eq(cardGroups.id, groupId), eq(cardGroups.userId, userId)));
}

/** The stacks carrying this group's label. */
export async function listGroupItems(
  db: Database,
  userId: string,
  groupId: string,
  query: GroupItemQuery,
): Promise<Page<CollectionItem>> {
  await getGroupForOwner(db, userId, groupId);
  return listItemsInGroup(db, groupId, query);
}

/** Puts a stack in a group. Adding twice is not an error. */
export async function addMembership(
  db: Database,
  userId: string,
  groupId: string,
  itemId: string,
): Promise<void> {
  await getGroupForOwner(db, userId, groupId);
  const owned = await db
    .select({ id: collectionItems.id })
    .from(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .limit(1);
  if (owned.length === 0) throw ApiError.notFound('Card not found in your collection');

  await db.insert(groupMemberships).values({ itemId, groupId, userId }).onConflictDoNothing();
}

/** Takes a stack out of a group. The stack stays in the collection. */
export async function removeMembership(
  db: Database,
  userId: string,
  groupId: string,
  itemId: string,
): Promise<void> {
  await getGroupForOwner(db, userId, groupId);
  await db
    .delete(groupMemberships)
    .where(
      and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.itemId, itemId),
        eq(groupMemberships.userId, userId),
      ),
    );
}
