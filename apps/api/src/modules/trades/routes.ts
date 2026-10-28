import { zValidator } from '@hono/zod-validator';
import { createTradeSchema, tradeLinesSchema } from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context';
import { requireAuth, requireUser } from '../../middleware/auth';
import {
  cancelTrade,
  finalizeTrade,
  getTrade,
  listChoices,
  listTrades,
  openTrade,
  proposeTrade,
} from './service';

export const tradeRoutes = new Hono<AppEnv>();

tradeRoutes.use('*', requireAuth, requireUser);

const tradeIdParam = z.object({ id: z.string().uuid() });

tradeRoutes.get('/', async (c) => {
  const items = await listTrades(c.get('db'), c.get('user').id);
  return c.json({ items });
});

tradeRoutes.post('/', zValidator('json', createTradeSchema), async (c) => {
  const trade = await openTrade(c.get('db'), c.get('user').id, c.req.valid('json'));
  return c.json(trade, 201);
});

tradeRoutes.get('/:id/choices', zValidator('param', tradeIdParam), async (c) => {
  return c.json(await listChoices(c.get('db'), c.get('user').id, c.req.valid('param').id));
});

tradeRoutes.get('/:id', zValidator('param', tradeIdParam), async (c) => {
  const trade = await getTrade(c.get('db'), c.get('user').id, c.req.valid('param').id);
  return c.json(trade);
});

tradeRoutes.post(
  '/:id/propose',
  zValidator('param', tradeIdParam),
  zValidator('json', tradeLinesSchema),
  async (c) => {
    const trade = await proposeTrade(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(trade);
  },
);

tradeRoutes.post(
  '/:id/finalize',
  zValidator('param', tradeIdParam),
  zValidator('json', tradeLinesSchema),
  async (c) => {
    const trade = await finalizeTrade(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(trade);
  },
);

tradeRoutes.post('/:id/cancel', zValidator('param', tradeIdParam), async (c) => {
  const trade = await cancelTrade(c.get('db'), c.get('user').id, c.req.valid('param').id);
  return c.json(trade);
});
