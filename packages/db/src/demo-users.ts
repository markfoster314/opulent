import { CARD_GAME } from '@opulent/shared';
import { and, eq, like } from 'drizzle-orm';
import type { Database } from './client';
import { cards, collectionItems, users, wantItems } from './schema';

export interface DemoUserOptions {
  placeId: number;
  count: number;
  prefix: string;
  matchUserId?: string;
}

const SUFFIX_LENGTH = 4;

/** Kept pure so the name rules can be tested without a database. */
export function demoUsername(prefix: string, index: number, suffix: string): string {
  return `dev_${prefix}_${index}_${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

function randomSuffix(): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + SUFFIX_LENGTH)
    .padEnd(SUFFIX_LENGTH, '0');
}

async function wantedPrintings(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ scryfallId: cards.scryfallId })
    .from(wantItems)
    .innerJoin(cards, eq(cards.oracleId, wantItems.oracleId))
    .where(and(eq(wantItems.userId, userId), eq(cards.game, CARD_GAME)))
    .limit(12);
  return rows.map((row) => row.scryfallId);
}

/** Local demo rows only: the auth0 subject carries a `seed|dev_` prefix, which deleteDemoUsers finds. */
export async function createDemoUsers(db: Database, options: DemoUserOptions): Promise<string[]> {
  const pool = options.matchUserId ? await wantedPrintings(db, options.matchUserId) : [];
  const suffix = randomSuffix();

  return db.transaction(async (tx) => {
    const created: string[] = [];

    for (let index = 0; index < options.count; index += 1) {
      const username = demoUsername(options.prefix, index, suffix);
      const [row] = await tx
        .insert(users)
        .values({
          auth0Sub: `seed|${username}`,
          username,
          email: `${username}@seed.opulent.local`,
          placeId: options.placeId,
          bio: 'Demo user for local testing.',
          profileVisibility: 'public',
          tradeBinderVisibility: 'public',
          onboardedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: users.username })
        .returning({ id: users.id, username: users.username });

      if (!row) continue;
      created.push(row.username);

      if (pool.length > 0) {
        await tx
          .insert(collectionItems)
          .values(
            pool.slice(0, 2).map((scryfallId) => ({ userId: row.id, scryfallId, forTrade: true })),
          )
          .onConflictDoNothing();
      }
    }

    return created;
  });
}

export async function deleteDemoUsers(db: Database): Promise<number> {
  const removed = await db
    .delete(users)
    .where(like(users.auth0Sub, 'seed|dev_%'))
    .returning({ id: users.id });
  return removed.length;
}
