import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/** Keeps the password out of templates and env vars: local uses DATABASE_URL, AWS passes DB_SECRET_ARN and DB_HOST to Secrets Manager. */
let resolution: Promise<string> | undefined;

async function resolve(): Promise<string> {
  const direct = process.env.DATABASE_URL;
  if (direct) return direct;

  const secretArn = process.env.DB_SECRET_ARN;
  const host = process.env.DB_HOST;
  if (!secretArn || !host) {
    throw new Error('Set DATABASE_URL, or both DB_SECRET_ARN and DB_HOST');
  }

  const client = new SecretsManagerClient({});
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} has no string value`);
  }

  const secret = JSON.parse(response.SecretString) as { username: string; password: string };
  const database = process.env.DB_NAME ?? 'opulent_tutor';
  const port = process.env.DB_PORT ?? '5432';

  return (
    `postgres://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}` +
    `@${host}:${port}/${database}?sslmode=require`
  );
}

export function resolveConnectionString(): Promise<string> {
  if (!resolution) {
    resolution = resolve();
  }
  return resolution;
}

/** Sets DATABASE_URL once so getDatabase() stays synchronous; the cached promise shares one Secrets Manager call across cold starts. */
export async function ensureDatabaseUrl(): Promise<void> {
  process.env.DATABASE_URL = await resolveConnectionString();
}
