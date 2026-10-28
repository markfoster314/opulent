import { ensureDatabaseUrl, getDatabase } from '@opulent/db';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
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

/** Above the 2,000,000 character CSV cap, and under API Gateway's 10 MB limit. */
export const BODY_MAX_BYTES = 3_000_000;

export const limitBody = bodyLimit({
  maxSize: BODY_MAX_BYTES,
  onError: (c) => c.json({ error: { code: 'bad_request', message: 'Request is too large' } }, 413),
});

/** A module may import another module's service.ts only. */
export function createApp() {
  const env = getEnv();
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use('*', limitBody);
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
