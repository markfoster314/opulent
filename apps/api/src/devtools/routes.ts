import {
  assertLocalDatabase,
  createDemoUsers,
  deleteDemoUsers,
  users,
  wantItems,
} from '@opulent/db';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../lib/context';
import { searchPlaces } from '../modules/places/service';

const createUsersSchema = z.object({
  placeId: z.number().int().positive(),
  count: z.number().int().min(1).max(100),
  prefix: z.string().regex(/^[a-z0-9_]{1,10}$/),
  matchUserId: z.string().uuid().optional(),
});

/** Mounted by the local entry only, so the deployed Lambda never sees these routes. */
export const devRoutes = new Hono<AppEnv>();

devRoutes.use('*', async (c, next) => {
  try {
    assertLocalDatabase();
  } catch {
    return c.json(
      { error: { code: 'forbidden', message: 'Dev routes need a local database' } },
      403,
    );
  }
  await next();
});

devRoutes.get('/places', async (c) => {
  const query = c.req.query('q') ?? '';
  if (!query.trim()) return c.json({ items: [] });
  return c.json({ items: await searchPlaces(c.get('db'), query) });
});

devRoutes.get('/viewers', async (c) => {
  const items = await c
    .get('db')
    .select({ id: users.id, username: users.username, wantCount: sql<number>`count(*)::int` })
    .from(wantItems)
    .innerJoin(users, eq(users.id, wantItems.userId))
    .groupBy(users.id, users.username)
    .orderBy(sql`count(*) desc`)
    .limit(5);
  return c.json({ items });
});

devRoutes.post('/users', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = createUsersSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'bad_request', message: 'Invalid demo user request' } }, 400);
  }

  const usernames = await createDemoUsers(c.get('db'), parsed.data);
  return c.json({ created: usernames.length, usernames });
});

devRoutes.delete('/users', async (c) => {
  const removed = await deleteDemoUsers(c.get('db'));
  return c.json({ removed });
});
