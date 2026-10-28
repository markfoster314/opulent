import { ensureDatabaseUrl, getDatabase } from '@opulent/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { getEnv } from './env';
import type { AppEnv } from './lib/context';
import { onError, onNotFound } from './middleware/error';
import { cardRoutes } from './modules/cards/routes';
import { groupRoutes } from './modules/groups/routes';
import { collectionRoutes } from './modules/collection/routes';
import { matchRoutes } from './modules/matches/routes';
import { healthRoutes } from './modules/health/routes';
import { placeRoutes } from './modules/places/routes';
import { tradeRoutes } from './modules/trades/routes';
import { userRoutes } from './modules/users/routes';
import { wantRoutes } from './modules/wants/routes';

/** Modules share service functions, never tables, so each can be split out later. */
export function createApp() {
  const env = getEnv();
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use('*', logger());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: env.corsOrigins,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86400,
    }),
  );

  // One db handle per process; AWS Secrets Manager may resolve the URL on cold start.
  app.use('*', async (c, next) => {
    await ensureDatabaseUrl();
    c.set('db', getDatabase());
    await next();
  });

  // Personal data must not be cached; set early so public card routes can override.
  app.use('/v1/*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    await next();
  });

  app.route('/health', healthRoutes);
  app.route('/v1/users', userRoutes);
  app.route('/v1/places', placeRoutes);
  app.route('/v1/cards', cardRoutes);
  app.route('/v1/collection', collectionRoutes);
  app.route('/v1/matches', matchRoutes);
  app.route('/v1/groups', groupRoutes);
  app.route('/v1/wants', wantRoutes);
  app.route('/v1/trades', tradeRoutes);

  app.notFound(onNotFound);
  app.onError(onError);

  return app;
}
