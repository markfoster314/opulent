const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Seed, reset, and push wipe or reshape data. A remote host needs ALLOW_REMOTE_DB=1. */
export function assertLocalDatabase(connectionString = process.env.DATABASE_URL): void {
  if (process.env.ALLOW_REMOTE_DB === '1') return;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to the repo .env file.');
  }

  let host: string;
  try {
    // URL.hostname keeps the brackets on an IPv6 address.
    host = new URL(connectionString).hostname.replace(/^\[|\]$/g, '');
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  if (LOCAL_HOSTS.has(host)) return;
  throw new Error(
    `Refusing ${host}. This script only runs on a local database. Set ALLOW_REMOTE_DB=1 to override.`,
  );
}
