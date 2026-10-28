import { zValidator } from '../../lib/validate';
import {
  addCollectionItemSchema,
  collectionCardsQuerySchema,
  collectionHighlightsQuerySchema,
  collectionItemQuerySchema,
  collectionImportSchema,
  collectionMoversQuerySchema,
  collectionValueBreakdownQuerySchema,
  collectionValueHistoryQuerySchema,
  splitCollectionItemSchema,
  updateCollectionItemSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { requireAuth, requireUser } from '../../middleware/auth';
import {
  addCollectionItem,
  getCollectionItem,
  getCollectionSummary,
  listCollectionCardsByValue,
  listCollectionHighlights,
  listCollectionMovers,
  listCollectionItems,
  removeCollectionItem,
  splitCollectionItem,
  updateCollectionItem,
} from './service';
import { exportCollectionCsv, importCollection } from './import';
import { getCollectionValueBreakdown, getCollectionValueHistory } from './value';

/** Signed-in owner's cards; groups are labels and the trade binder is every for-trade stack. */
export const collectionRoutes = new Hono<AppEnv>();

const itemParam = z.object({ itemId: z.string().uuid() });

collectionRoutes.use('*', requireAuth, requireUser);

collectionRoutes.get('/summary', async (c) => {
  return c.json(await getCollectionSummary(c.get('db'), c.get('user').id));
});

collectionRoutes.get('/cards', zValidator('query', collectionCardsQuerySchema), async (c) => {
  const { limit, cursor, sort, dir, range, changeBy, ...filters } = c.req.valid('query');
  return c.json(
    await listCollectionCardsByValue(c.get('db'), c.get('user').id, {
      limit,
      cursor,
      sort,
      dir,
      range,
      changeBy,
      filters,
    }),
  );
});

collectionRoutes.get(
  '/value-history',
  zValidator('query', collectionValueHistoryQuerySchema),
  async (c) => {
    const { range } = c.req.valid('query');
    return c.json(await getCollectionValueHistory(c.get('db'), c.get('user').id, range));
  },
);

collectionRoutes.get(
  '/value-breakdown',
  zValidator('query', collectionValueBreakdownQuerySchema),
  async (c) => {
    const { by } = c.req.valid('query');
    return c.json(await getCollectionValueBreakdown(c.get('db'), c.get('user').id, by));
  },
);

collectionRoutes.get('/movers', zValidator('query', collectionMoversQuerySchema), async (c) => {
  const { limit, range, changeBy } = c.req.valid('query');
  return c.json(
    await listCollectionMovers(c.get('db'), c.get('user').id, { limit, range, changeBy }),
  );
});

collectionRoutes.get(
  '/highlights',
  zValidator('query', collectionHighlightsQuerySchema),
  async (c) => {
    return c.json({
      items: await listCollectionHighlights(
        c.get('db'),
        c.get('user').id,
        c.req.valid('query').limit,
      ),
    });
  },
);

collectionRoutes.get('/items', zValidator('query', collectionItemQuerySchema), async (c) => {
  return c.json(await listCollectionItems(c.get('db'), c.get('user').id, c.req.valid('query')));
});

collectionRoutes.post('/items', zValidator('json', addCollectionItemSchema), async (c) => {
  return c.json(await addCollectionItem(c.get('db'), c.get('user').id, c.req.valid('json')), 201);
});

collectionRoutes.get('/items/:itemId', zValidator('param', itemParam), async (c) => {
  return c.json(
    await getCollectionItem(c.get('db'), c.get('user').id, c.req.valid('param').itemId),
  );
});

collectionRoutes.post(
  '/items/:itemId/split',
  zValidator('param', itemParam),
  zValidator('json', splitCollectionItemSchema),
  async (c) => {
    await splitCollectionItem(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').itemId,
      c.req.valid('json'),
    );
    return c.body(null, 204);
  },
);

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

collectionRoutes.post('/import', zValidator('json', collectionImportSchema), async (c) => {
  return c.json(await importCollection(c.get('db'), c.get('user').id, c.req.valid('json')));
});

collectionRoutes.get(
  '/export.csv',
  zValidator('query', z.object({ groupId: z.string().uuid().optional() })),
  async (c) => {
    const csv = await exportCollectionCsv(
      c.get('db'),
      c.get('user').id,
      c.req.valid('query').groupId,
    );
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="opulent-tutor-collection.csv"');
    return c.body(csv);
  },
);
