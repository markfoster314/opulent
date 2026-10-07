import { zValidator } from '@hono/zod-validator';
import { addWantItemSchema, updateWantItemSchema } from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { requireAuth, requireUser } from '../../middleware/auth';
import { addWant, listWants, removeWant, updateWant } from './service';

export const wantRoutes = new Hono<AppEnv>();

const wantIdParam = z.object({ id: z.string().uuid() });

// A want list is always private to its owner.
wantRoutes.use('*', requireAuth, requireUser);

wantRoutes.get('/', async (c) => {
  const items = await listWants(c.get('db'), c.get('user').id);
  return c.json({ items });
});

wantRoutes.post('/', zValidator('json', addWantItemSchema), async (c) => {
  const want = await addWant(c.get('db'), c.get('user').id, c.req.valid('json'));
  return c.json(want, 201);
});

wantRoutes.patch(
  '/:id',
  zValidator('param', wantIdParam),
  zValidator('json', updateWantItemSchema),
  async (c) => {
    const want = await updateWant(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(want);
  },
);

wantRoutes.delete('/:id', zValidator('param', wantIdParam), async (c) => {
  await removeWant(c.get('db'), c.get('user').id, c.req.valid('param').id);
  return c.body(null, 204);
});
