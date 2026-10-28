import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { rdsCa } from './rds-ca';

/** Local uses DATABASE_URL. AWS passes DB_SECRET_ARN and DB_HOST, and the password stays in memory. */
let resolution: Promise<string> | undefined;
let secretUrl: string | undefined;

export function awsDatabaseUrl(input: {
  username: string;
  password: string;
  host: string;
  port: string;
  database: string;
}): string {
  const user = encodeURIComponent(input.username);
  const password = encodeURIComponent(input.password);
  return `postgresql://${user}:${password}@${input.host}:${input.port}/${input.database}?sslmode=verify-full`;
}

/**
 * postgres.js treats sslmode=verify-full as a string and never loads a CA.
 * An ssl object is what actually checks the RDS certificate.
 */
export function postgresSsl(
  connectionString: string,
): { ssl: { ca: string; rejectUnauthorized: true } } | Record<string, never> {
  let mode: string | null;
  try {
    mode = new URL(connectionString).searchParams.get('sslmode');
  } catch {
    return {};
  }
  if (mode !== 'verify-full') return {};
  return { ssl: { ca: rdsCa, rejectUnauthorized: true } };
}

async function resolve(): Promise<string> {
  const direct = process.env.DATABASE_URL;
  if (direct) return direct;

  const secretArn = process.env.DB_SECRET_ARN;
  const host = process.env.DB_HOST;
  if (!secretArn || !host) {
    throw new Error('Set DATABASE_URL, or both DB_SECRET_ARN and DB_HOST');
  }

  const client = new SecretsManagerClient({});
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
    if (!response.SecretString) {
      throw new Error(`Secret ${secretArn} has no string value`);
    }

    const secret = JSON.parse(response.SecretString) as { username: string; password: string };
    const database = process.env.DB_NAME ?? 'opulent_tutor';
    const port = process.env.DB_PORT ?? '5432';

    return awsDatabaseUrl({
      username: secret.username,
      password: secret.password,
      host,
      port,
      database,
    });
  } finally {
    // A live client keeps the process open after the job has finished.
    client.destroy();
  }
}

export function resolveConnectionString(): Promise<string> {
  if (!resolution) {
    resolution = resolve();
  }
  return resolution;
}

/** Returns the URL. A secret is not copied into process.env. */
export async function ensureDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  secretUrl ??= await resolveConnectionString();
  return secretUrl;
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? secretUrl;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}
