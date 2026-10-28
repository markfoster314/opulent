import { applyBootstrap } from './bootstrap-sql';
import { loadEnv } from './load-env';

loadEnv();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  await applyBootstrap(connectionString);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
