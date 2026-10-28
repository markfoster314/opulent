import { zValidator } from '@hono/zod-validator';
import {
  addWantItemSchema,
  createGenericWantSchema,
  createWantListSchema,
  slugSchema,
  updateWantItemSchema,
  updateWantListSchema,
  usernameSchema,
  wantsImportSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { ApiError } from '../../lib/http';
import { optionalAuth, requireAuth, requireUser } from '../../middleware/auth';
import { getUserByUsername } from '../users/service';
import { exportWantsCsv, importWants } from './import';
import {
  addWantItem,
  assertCanViewWantList,
  createGenericWant,
  createWantList,
  deleteWantList,
  findGenericMatchOwners,
  getWantList,
  getWantListByHandleAndSlug,
  listAllWantItems,
  listGenericWants,
  listWantItems,
  listCollectedWants,
  listWantLists,
  removeGenericWant,
  removeWantFromList,
  removeWantItem,
  rotateWantShareToken,
  toPublicWantList,
  updateWantItem,
  updateWantList,
} from './service';

export const wantRoutes = new Hono<AppEnv>();

const listIdParam = z.object({ id: z.string().uuid() });
const itemParam = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
const shareParam = z.object({ handle: usernameSchema, slug: slugSchema });

function viewer(shareToken: string | undefined, userId: string | undefined) {
  return { userId, shareToken };
}

wantRoutes.get('/generic/matches', requireAuth, requireUser, async (c) => {
  const items = await findGenericMatchOwners(c.get('db'), c.get('user').id, 20);
  return c.json({ items });
});

wantRoutes.get('/generic', requireAuth, requireUser, async (c) => {
  const items = await listGenericWants(c.get('db'), c.get('user').id);
  return c.json({ items });
});

wantRoutes.post(
  '/generic',
  requireAuth,
  requireUser,
  zValidator('json', createGenericWantSchema),
  async (c) => {
    const item = await createGenericWant(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(item, 201);
  },
);

wantRoutes.delete(
  '/generic/:id',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  async (c) => {
    await removeGenericWant(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return c.body(null, 204);
  },
);

wantRoutes.get('/mine/items', requireAuth, requireUser, async (c) => {
  const items = await listCollectedWants(c.get('db'), c.get('user').id, false);
  return c.json({ items });
});

wantRoutes.get(
  '/by/:handle/public-items',
  zValidator('param', z.object({ handle: usernameSchema })),
  async (c) => {
    const db = c.get('db');
    const user = await getUserByUsername(db, c.req.valid('param').handle);
    if (!user) throw ApiError.notFound('User not found');
    const items = await listCollectedWants(db, user.id, true);
    return c.json({ items });
  },
);

wantRoutes.post(
  '/import',
  requireAuth,
  requireUser,
  zValidator('json', wantsImportSchema),
  async (c) => {
    return c.json(await importWants(c.get('db'), c.get('user').id, c.req.valid('json')));
  },
);

wantRoutes.get('/export.csv', requireAuth, requireUser, async (c) => {
  const csv = await exportWantsCsv(c.get('db'), c.get('user').id);
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="opulent-tutor-wants.csv"');
  return c.body(csv);
});

wantRoutes.get('/lists', requireAuth, requireUser, async (c) => {
  const items = await listWantLists(c.get('db'), c.get('user').id);
  return c.json({ items });
});

wantRoutes.post(
  '/lists',
  requireAuth,
  requireUser,
  zValidator('json', createWantListSchema),
  async (c) => {
    const list = await createWantList(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(list, 201);
  },
);

wantRoutes.get(
  '/lists/:id/export.csv',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  async (c) => {
    const db = c.get('db');
    const userId = c.get('user').id;
    const listId = c.req.valid('param').id;
    await getWantList(db, userId, listId);
    const csv = await exportWantsCsv(db, userId, listId);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="opulent-tutor-wants.csv"');
    return c.body(csv);
  },
);

wantRoutes.get(
  '/lists/:id',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  async (c) => {
    const list = await getWantList(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return c.json(list);
  },
);

wantRoutes.patch(
  '/lists/:id',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  zValidator('json', updateWantListSchema),
  async (c) => {
    const list = await updateWantList(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(list);
  },
);

wantRoutes.delete(
  '/lists/:id',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  async (c) => {
    await deleteWantList(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return c.body(null, 204);
  },
);

wantRoutes.post(
  '/lists/:id/share-token/rotate',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  async (c) => {
    const db = c.get('db');
    const userId = c.get('user').id;
    const listId = c.req.valid('param').id;
    await getWantList(db, userId, listId);
    return c.json({ shareToken: await rotateWantShareToken(db, userId, listId) });
  },
);

wantRoutes.get('/items', requireAuth, requireUser, async (c) => {
  const items = await listAllWantItems(c.get('db'), c.get('user').id);
  return c.json({ items });
});

wantRoutes.post(
  '/items',
  requireAuth,
  requireUser,
  zValidator('json', addWantItemSchema),
  async (c) => {
    const item = await addWantItem(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(item, 201);
  },
);

wantRoutes.patch(
  '/items/:id',
  requireAuth,
  requireUser,
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', updateWantItemSchema),
  async (c) => {
    const item = await updateWantItem(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(item);
  },
);

wantRoutes.delete(
  '/items/:id',
  requireAuth,
  requireUser,
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    await removeWantItem(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return c.body(null, 204);
  },
);

wantRoutes.get(
  '/lists/:id/items',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  async (c) => {
    const db = c.get('db');
    const listId = c.req.valid('param').id;
    await getWantList(db, c.get('user').id, listId);
    const items = await listWantItems(db, listId, c.get('user').id);
    return c.json({ items });
  },
);

wantRoutes.post(
  '/lists/:id/items',
  requireAuth,
  requireUser,
  zValidator('param', listIdParam),
  zValidator('json', addWantItemSchema),
  async (c) => {
    const item = await addWantItem(c.get('db'), c.get('user').id, {
      ...c.req.valid('json'),
      listIds: [c.req.valid('param').id],
    });
    return c.json(item, 201);
  },
);

wantRoutes.delete(
  '/lists/:id/items/:itemId',
  requireAuth,
  requireUser,
  zValidator('param', itemParam),
  async (c) => {
    const { id, itemId } = c.req.valid('param');
    await removeWantFromList(c.get('db'), c.get('user').id, id, itemId);
    return c.body(null, 204);
  },
);

wantRoutes.get('/by/:handle/:slug', optionalAuth, zValidator('param', shareParam), async (c) => {
  const { handle, slug } = c.req.valid('param');
  const db = c.get('db');
  const viewerId = c.get('user')?.id;
  const row = await getWantListByHandleAndSlug(db, handle, slug);
  assertCanViewWantList(row, viewer(c.req.query('t'), viewerId));
  return c.json(await toPublicWantList(db, row, viewerId));
});

wantRoutes.get(
  '/by/:handle/:slug/items',
  optionalAuth,
  zValidator('param', shareParam),
  async (c) => {
    const { handle, slug } = c.req.valid('param');
    const db = c.get('db');
    const row = await getWantListByHandleAndSlug(db, handle, slug);
    assertCanViewWantList(row, viewer(c.req.query('t'), c.get('user')?.id));
    return c.json({ items: await listWantItems(db, row.id) });
  },
);
