import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';

export const healthRoutes = new Hono<AppEnv>();

/** Liveness. Answers even when the database is down. */
healthRoutes.get('/', (c) => c.json({ status: 'ok' }));

/** Readiness. Used by the load balancer and by deployment smoke tests. */
healthRoutes.get('/ready', async (c) => {
  try {
    await c.get('db').execute(sql`SELECT 1`);
    return c.json({ status: 'ok', database: 'up' });
  } catch {
    return c.json({ status: 'degraded', database: 'down' }, 503);
  }
});
