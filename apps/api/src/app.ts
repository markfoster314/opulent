import { ensureDatabaseUrl, getDatabase } from '@opulent/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { getEnv } from './env';
import type { AppEnv } from './lib/context';
import { onError, onNotFound } from './middleware/error';
import { binderRoutes } from './modules/binders/routes';
import { cardRoutes } from './modules/cards/routes';
import { healthRoutes } from './modules/health/routes';
import { userRoutes } from './modules/users/routes';
import { wantRoutes } from './modules/wants/routes';

/**
 * One deployable service with clearly separated modules inside it.
 *
 * Modules talk to each other only through exported service functions, never by
 * reading another module's tables directly. That rule is what will let any of
 * them be lifted into a separate service later without a rewrite.
 */
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

  // One database handle per process, shared by every request. The connection
  // string may need resolving from AWS Secrets Manager on a cold start.
  app.use('*', async (c, next) => {
    await ensureDatabaseUrl();
    c.set('db', getDatabase());
    await next();
  });

  app.route('/health', healthRoutes);
  app.route('/v1/users', userRoutes);
  app.route('/v1/cards', cardRoutes);
  app.route('/v1/binders', binderRoutes);
  app.route('/v1/wants', wantRoutes);

  app.notFound(onNotFound);
  app.onError(onError);

  return app;
}
