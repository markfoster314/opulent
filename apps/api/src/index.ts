import { serve } from '@hono/node-server';
import { loadEnv } from '@opulent/db/env';
import { createApp } from './app';
import { devRoutes } from './devtools/routes';
import { getEnv } from './env';

/** Local dev entry point; production uses lambda.ts and real env vars. */
loadEnv();

const env = getEnv();
const app = createApp();

if (env.NODE_ENV === 'development') {
  app.route('/__dev', devRoutes);
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
