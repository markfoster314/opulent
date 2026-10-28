import { zValidator } from '@hono/zod-validator';
import {
  collectionItemQuerySchema,
  createCardGroupSchema,
  updateCardGroupSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { requireAuth, requireUser } from '../../middleware/auth';
import {
  addMembership,
  createGroup,
  deleteGroup,
  getGroupForOwner,
  listGroupItems,
  listGroupsForOwner,
  removeMembership,
  updateGroup,
} from './service';

/** Private labels only; a card can sit in many groups or none and is never owned by one. */
export const groupRoutes = new Hono<AppEnv>();

groupRoutes.use('*', requireAuth, requireUser);

const groupParam = z.object({ groupId: z.string().uuid() });
const memberParam = z.object({ groupId: z.string().uuid(), itemId: z.string().uuid() });

groupRoutes.get('/', async (c) => {
  const items = await listGroupsForOwner(c.get('db'), c.get('user').id);
  return c.json({ items });
});

groupRoutes.post('/', zValidator('json', createCardGroupSchema), async (c) => {
  return c.json(await createGroup(c.get('db'), c.get('user').id, c.req.valid('json')), 201);
});

groupRoutes.get('/:groupId', zValidator('param', groupParam), async (c) => {
  return c.json(
    await getGroupForOwner(c.get('db'), c.get('user').id, c.req.valid('param').groupId),
  );
});

groupRoutes.patch(
  '/:groupId',
  zValidator('param', groupParam),
  zValidator('json', updateCardGroupSchema),
  async (c) => {
    return c.json(
      await updateGroup(
        c.get('db'),
        c.get('user').id,
        c.req.valid('param').groupId,
        c.req.valid('json'),
      ),
    );
  },
);

groupRoutes.delete('/:groupId', zValidator('param', groupParam), async (c) => {
  await deleteGroup(c.get('db'), c.get('user').id, c.req.valid('param').groupId);
  return c.body(null, 204);
});

groupRoutes.get(
  '/:groupId/items',
  zValidator('param', groupParam),
  zValidator('query', collectionItemQuerySchema),
  async (c) => {
    return c.json(
      await listGroupItems(
        c.get('db'),
        c.get('user').id,
        c.req.valid('param').groupId,
        c.req.valid('query'),
      ),
    );
  },
);

groupRoutes.post('/:groupId/items/:itemId', zValidator('param', memberParam), async (c) => {
  const { groupId, itemId } = c.req.valid('param');
  await addMembership(c.get('db'), c.get('user').id, groupId, itemId);
  return c.json({ ok: true }, 201);
});

/** Removes the label only; the card stays in the collection. */
groupRoutes.delete('/:groupId/items/:itemId', zValidator('param', memberParam), async (c) => {
  const { groupId, itemId } = c.req.valid('param');
  await removeMembership(c.get('db'), c.get('user').id, groupId, itemId);
  return c.body(null, 204);
});
