import { zValidator } from '@hono/zod-validator';
import {
  addCollectionItemSchema,
  collectionItemQuerySchema,
  collectionImportSchema,
  updateCollectionItemSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { requireAuth, requireUser } from '../../middleware/auth';
import {
  addCollectionItem,
  getCollectionSummary,
  listCollectionItems,
  removeCollectionItem,
  updateCollectionItem,
} from './service';
import { exportCollectionCsv, importCollection } from './import';

/**
 * The signed-in person's own cards, as one collection.
 *
 * A stack lives here first. Groups are labels joined through memberships, and
 * the trade binder is every stack marked for trade.
 */
export const collectionRoutes = new Hono<AppEnv>();

const itemParam = z.object({ itemId: z.string().uuid() });

collectionRoutes.use('*', requireAuth, requireUser);

collectionRoutes.get('/summary', async (c) => {
  return c.json(await getCollectionSummary(c.get('db'), c.get('user').id));
});

collectionRoutes.get('/items', zValidator('query', collectionItemQuerySchema), async (c) => {
  return c.json(await listCollectionItems(c.get('db'), c.get('user').id, c.req.valid('query')));
});

collectionRoutes.post('/items', zValidator('json', addCollectionItemSchema), async (c) => {
  return c.json(await addCollectionItem(c.get('db'), c.get('user').id, c.req.valid('json')), 201);
});

collectionRoutes.patch(
  '/items/:itemId',
  zValidator('param', itemParam),
  zValidator('json', updateCollectionItemSchema),
  async (c) => {
    return c.json(
      await updateCollectionItem(
        c.get('db'),
        c.get('user').id,
        c.req.valid('param').itemId,
        c.req.valid('json'),
      ),
    );
  },
);

collectionRoutes.delete('/items/:itemId', zValidator('param', itemParam), async (c) => {
  await removeCollectionItem(c.get('db'), c.get('user').id, c.req.valid('param').itemId);
  return c.body(null, 204);
});

/** CSV in. Dry run by default, so the screen can show a preview first. */
collectionRoutes.post('/import', zValidator('json', collectionImportSchema), async (c) => {
  return c.json(await importCollection(c.get('db'), c.get('user').id, c.req.valid('json')));
});

/** CSV out, in the plain format the importer also reads. */
collectionRoutes.get('/export.csv', async (c) => {
  const csv = await exportCollectionCsv(c.get('db'), c.get('user').id);
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="opulent-tutor-collection.csv"');
  return c.body(csv);
});
