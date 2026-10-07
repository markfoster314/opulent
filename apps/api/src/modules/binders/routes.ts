import { zValidator } from '@hono/zod-validator';
import {
  addBinderItemSchema,
  createBinderSchema,
  handleSchema,
  paginationQuerySchema,
  slugSchema,
  updateBinderItemSchema,
  updateBinderSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { ApiError } from '../../lib/http';
import { optionalAuth, requireAuth, requireUser } from '../../middleware/auth';
import {
  addBinderItem,
  assertCanEdit,
  assertCanView,
  createBinder,
  deleteBinder,
  findTradeMatches,
  getBinderByHandleAndSlug,
  getBinderById,
  listBinderItems,
  listBindersForOwner,
  listPublicBindersByHandle,
  removeBinderItem,
  rotateShareToken,
  updateBinder,
  updateBinderItem,
} from './service';

export const binderRoutes = new Hono<AppEnv>();

const binderIdParam = z.object({ id: z.string().uuid() });
const itemParam = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
const shareParam = z.object({ handle: handleSchema, slug: slugSchema });

/** Share links carry the token in the query string: ?t=abc123 */
function viewer(shareToken: string | undefined, userId: string | undefined) {
  return { userId, shareToken };
}

// --- Owner-scoped collection ---

binderRoutes.get('/', requireAuth, requireUser, async (c) => {
  const items = await listBindersForOwner(c.get('db'), c.get('user').id);
  return c.json({ items });
});

binderRoutes.post(
  '/',
  requireAuth,
  requireUser,
  zValidator('json', createBinderSchema),
  async (c) => {
    const binder = await createBinder(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(binder, 201);
  },
);

// --- Single binder ---

binderRoutes.get('/:id', optionalAuth, zValidator('param', binderIdParam), async (c) => {
  const binder = await getBinderById(c.get('db'), c.req.valid('param').id);
  assertCanView(binder, viewer(c.req.query('t'), c.get('user')?.id));
  return c.json(binder);
});

binderRoutes.patch(
  '/:id',
  requireAuth,
  requireUser,
  zValidator('param', binderIdParam),
  zValidator('json', updateBinderSchema),
  async (c) => {
    const db = c.get('db');
    const binder = await getBinderById(db, c.req.valid('param').id);
    assertCanEdit(binder, { userId: c.get('user').id });
    return c.json(await updateBinder(db, binder.id, c.req.valid('json')));
  },
);

binderRoutes.delete(
  '/:id',
  requireAuth,
  requireUser,
  zValidator('param', binderIdParam),
  async (c) => {
    const db = c.get('db');
    const binder = await getBinderById(db, c.req.valid('param').id);
    assertCanEdit(binder, { userId: c.get('user').id });
    await deleteBinder(db, binder.id);
    return c.body(null, 204);
  },
);

binderRoutes.post(
  '/:id/share-token/rotate',
  requireAuth,
  requireUser,
  zValidator('param', binderIdParam),
  async (c) => {
    const db = c.get('db');
    const binder = await getBinderById(db, c.req.valid('param').id);
    assertCanEdit(binder, { userId: c.get('user').id });
    return c.json({ shareToken: await rotateShareToken(db, binder.id) });
  },
);

// --- Cards inside a binder ---

binderRoutes.get(
  '/:id/items',
  optionalAuth,
  zValidator('param', binderIdParam),
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const db = c.get('db');
    const binder = await getBinderById(db, c.req.valid('param').id);
    assertCanView(binder, viewer(c.req.query('t'), c.get('user')?.id));
    return c.json(await listBinderItems(db, binder.id, c.req.valid('query')));
  },
);

binderRoutes.post(
  '/:id/items',
  requireAuth,
  requireUser,
  zValidator('param', binderIdParam),
  zValidator('json', addBinderItemSchema),
  async (c) => {
    const db = c.get('db');
    const binder = await getBinderById(db, c.req.valid('param').id);
    assertCanEdit(binder, { userId: c.get('user').id });
    return c.json(await addBinderItem(db, binder.id, c.req.valid('json')), 201);
  },
);

binderRoutes.patch(
  '/:id/items/:itemId',
  requireAuth,
  requireUser,
  zValidator('param', itemParam),
  zValidator('json', updateBinderItemSchema),
  async (c) => {
    const db = c.get('db');
    const { id, itemId } = c.req.valid('param');
    const binder = await getBinderById(db, id);
    assertCanEdit(binder, { userId: c.get('user').id });
    return c.json(await updateBinderItem(db, binder.id, itemId, c.req.valid('json')));
  },
);

binderRoutes.delete(
  '/:id/items/:itemId',
  requireAuth,
  requireUser,
  zValidator('param', itemParam),
  async (c) => {
    const db = c.get('db');
    const { id, itemId } = c.req.valid('param');
    const binder = await getBinderById(db, id);
    assertCanEdit(binder, { userId: c.get('user').id });
    await removeBinderItem(db, binder.id, itemId);
    return c.body(null, 204);
  },
);

// --- The headline feature ---

/** Cards on my want list that this binder's owner holds for trade. */
binderRoutes.get(
  '/:id/matches',
  requireAuth,
  requireUser,
  zValidator('param', binderIdParam),
  async (c) => {
    const db = c.get('db');
    const currentUser = c.get('user');
    const binder = await getBinderById(db, c.req.valid('param').id);
    assertCanView(binder, viewer(c.req.query('t'), currentUser.id));

    if (binder.userId === currentUser.id) {
      throw ApiError.badRequest('Matching your want list against your own binder is not useful');
    }

    const items = await findTradeMatches(db, binder.id, currentUser.id);
    return c.json({ items });
  },
);

// --- Public share URLs: /v1/binders/by/:handle/:slug ---

binderRoutes.get(
  '/by/:handle',
  zValidator('param', z.object({ handle: handleSchema })),
  async (c) => {
    const items = await listPublicBindersByHandle(c.get('db'), c.req.valid('param').handle);
    return c.json({ items });
  },
);

binderRoutes.get('/by/:handle/:slug', optionalAuth, zValidator('param', shareParam), async (c) => {
  const { handle, slug } = c.req.valid('param');
  const binder = await getBinderByHandleAndSlug(c.get('db'), handle, slug);
  assertCanView(binder, viewer(c.req.query('t'), c.get('user')?.id));
  return c.json(binder);
});
