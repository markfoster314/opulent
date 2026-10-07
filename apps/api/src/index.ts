import { serve } from '@hono/node-server';
import { loadEnv } from '@opulent/db/env';
import { createApp } from './app';
import { getEnv } from './env';

/**
 * Local development entry point. Production uses src/lambda.ts, where
 * configuration arrives as real environment variables rather than a .env file.
 */
loadEnv();

const env = getEnv();

serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
