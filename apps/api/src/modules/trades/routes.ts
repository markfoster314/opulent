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

const tradeIdParam = z.object({ id: z.string().uuid() });

tradeRoutes.get('/', requireAuth, requireUser, async (c) => {
  const items = await listTrades(c.get('db'), c.get('user').id);
  return c.json({ items });
});

tradeRoutes.post(
  '/',
  requireAuth,
  requireUser,
  zValidator('json', createTradeSchema),
  async (c) => {
    const trade = await openTrade(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(trade, 201);
  },
);

tradeRoutes.get(
  '/:id/choices',
  requireAuth,
  requireUser,
  zValidator('param', tradeIdParam),
  async (c) => {
    const items = await listChoices(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return c.json({ items });
  },
);

tradeRoutes.get('/:id', requireAuth, requireUser, zValidator('param', tradeIdParam), async (c) => {
  const trade = await getTrade(c.get('db'), c.get('user').id, c.req.valid('param').id);
  return c.json(trade);
});

tradeRoutes.post(
  '/:id/propose',
  requireAuth,
  requireUser,
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
  requireAuth,
  requireUser,
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

tradeRoutes.post(
  '/:id/cancel',
  requireAuth,
  requireUser,
  zValidator('param', tradeIdParam),
  async (c) => {
    const trade = await cancelTrade(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return c.json(trade);
  },
);
