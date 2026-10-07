import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/load-env';

loadEnv();

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://opulent:opulent@localhost:5432/opulent_tutor',
  },
  verbose: true,
  strict: true,
});
