import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  /** Optional: in AWS the connection string is built from DB_SECRET_ARN instead. */
  DATABASE_URL: z.string().min(1).optional(),
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().min(1),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[] };

let cached: Env | undefined;

/** Fails fast at boot rather than on the first request that touches a missing value. */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }

  cached = {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  };
  return cached;
}
