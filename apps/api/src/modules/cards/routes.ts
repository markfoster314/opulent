import { zValidator } from '@hono/zod-validator';
import {
  cardPriceSeriesQuerySchema,
  cardPrintingsQuerySchema,
  cardSearchQuerySchema,
  setSearchQuerySchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { ApiError } from '../../lib/http';
import {
  getCardById,
  getCardPriceSeries,
  getPrintingsByOracleId,
  listLanguagePrintings,
  listOracleChoices,
  listSetsByOracleId,
  searchCards,
  searchSets,
} from './service';

export const cardRoutes = new Hono<AppEnv>();

const uuidParam = z.object({ id: z.string().uuid() });

/**
 * Public on purpose. The Scryfall terms require that card data stay reachable
 * without a paid account, so card lookup sits outside the auth wall.
 */
cardRoutes.get('/search', zValidator('query', cardSearchQuerySchema), async (c) => {
  const items = await searchCards(c.get('db'), c.req.valid('query'));
  return c.json({ items });
});

cardRoutes.get('/sets', zValidator('query', setSearchQuerySchema), async (c) => {
  const items = await searchSets(c.get('db'), c.req.valid('query'));
  return c.json({ items });
});

cardRoutes.get('/:id/languages', zValidator('param', uuidParam), async (c) => {
  const items = await listLanguagePrintings(c.get('db'), c.req.valid('param').id);
  if (items.length === 0) throw ApiError.notFound('Card not found');
  return c.json({ items });
});

cardRoutes.get(
  '/:id/prices',
  zValidator('param', uuidParam),
  zValidator('query', cardPriceSeriesQuerySchema),
  async (c) => {
    return c.json(
      await getCardPriceSeries(c.get('db'), c.req.valid('param').id, c.req.valid('query').range),
    );
  },
);

cardRoutes.get('/:id', zValidator('param', uuidParam), async (c) => {
  const card = await getCardById(c.get('db'), c.req.valid('param').id);
  if (!card) throw ApiError.notFound('Card not found');
  return c.json(card);
});

cardRoutes.get('/oracle/:id/choices', zValidator('param', uuidParam), async (c) => {
  const choices = await listOracleChoices(c.get('db'), c.req.valid('param').id);
  return c.json(choices);
});

cardRoutes.get('/oracle/:id/sets', zValidator('param', uuidParam), async (c) => {
  const items = await listSetsByOracleId(c.get('db'), c.req.valid('param').id);
  return c.json({ items });
});

cardRoutes.get(
  '/oracle/:id/printings',
  zValidator('param', uuidParam),
  zValidator('query', cardPrintingsQuerySchema),
  async (c) => {
    const page = await getPrintingsByOracleId(
      c.get('db'),
      c.req.valid('param').id,
      c.req.valid('query'),
    );
    return c.json(page);
  },
);
