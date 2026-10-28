import { serve } from '@hono/node-server';
import { loadEnv } from '@opulent/db/env';
import { createApp } from './app';
import { getEnv } from './env';

/** Local dev entry point; production uses lambda.ts and real env vars. */
loadEnv();

const env = getEnv();

serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
