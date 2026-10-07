import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/**
 * Resolves the database connection string without ever writing the password
 * into a CloudFormation template or an environment variable.
 *
 * Local development sets DATABASE_URL directly. In AWS, the stack passes
 * DB_SECRET_ARN and DB_HOST instead, and the password is fetched from AWS
 * Secrets Manager on first use.
 */
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

/**
 * Sets process.env.DATABASE_URL once per process, so getDatabase() can stay a
 * simple synchronous getter. The promise is cached, so concurrent cold-start
 * requests make one Secrets Manager call between them.
 */
export async function ensureDatabaseUrl(): Promise<void> {
  process.env.DATABASE_URL = await resolveConnectionString();
}
