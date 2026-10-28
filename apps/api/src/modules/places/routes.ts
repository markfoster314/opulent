import { zValidator } from '@hono/zod-validator';
import { placeSearchQuerySchema } from '@opulent/shared';
import { Hono } from 'hono';
import { requireAuth, requireUser } from '../../middleware/auth';
import type { AppEnv } from '../../lib/context';
import { searchPlaces } from './service';

export const placeRoutes = new Hono<AppEnv>();

placeRoutes.use('*', requireAuth, requireUser);

placeRoutes.get('/', zValidator('query', placeSearchQuerySchema), async (c) => {
  const items = await searchPlaces(c.get('db'), c.req.valid('query').q);
  return c.json({ items });
});
