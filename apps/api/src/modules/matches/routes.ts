import { zValidator } from '@hono/zod-validator';
import { matchesQuerySchema } from '@opulent/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';
import { requireAuth, requireUser } from '../../middleware/auth';
import { findMatchOwners } from './service';

/** Find trades: people with public trade binders holding cards on my want lists. */
export const matchRoutes = new Hono<AppEnv>();

matchRoutes.get('/', requireAuth, requireUser, zValidator('query', matchesQuerySchema), async (c) => {
  const items = await findMatchOwners(c.get('db'), c.get('user').id, c.req.valid('query').limit);
  return c.json({ items });
});
