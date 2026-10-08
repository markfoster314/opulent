import { zValidator } from '@hono/zod-validator';
import { placeSearchQuerySchema } from '@opulent/shared';
import { Hono } from 'hono';
import { requireAuth, requireUser } from '../../middleware/auth';
import type { AppEnv } from '../../lib/context';
import { searchPlaces } from './service';

export const placeRoutes = new Hono<AppEnv>();

/** City picker for the welcome screen and profile. Signed-in only. */
placeRoutes.get(
  '/',
  requireAuth,
  requireUser,
  zValidator('query', placeSearchQuerySchema),
  async (c) => {
    const items = await searchPlaces(c.get('db'), c.req.valid('query').q);
    return c.json({ items });
  },
);
