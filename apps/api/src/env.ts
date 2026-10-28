import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  /** Optional: AWS builds this from DB_SECRET_ARN instead. */
  DATABASE_URL: z.string().min(1).optional(),
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().min(1),
  /** Comma-separated allowed browser origins. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Set both to send trade emails through Resend. */
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  /** Email links point here; falls back to the first CORS origin. */
  WEB_ORIGIN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[] };

let cached: Env | undefined;

/** Fails fast at boot instead of on the first request. */
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
