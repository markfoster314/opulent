import { users } from '@opulent/db';
import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getEnv } from '../env';
import type { AppEnv, Auth0Claims } from '../lib/context';
import { ApiError, slugify } from '../lib/http';

/** Module-level so jose can cache keys; rebuilding per request would refetch them. */
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  if (!jwks) {
    const { AUTH0_DOMAIN } = getEnv();
    jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
  }
  return jwks;
}

/** API Gateway rejects bad tokens in prod; verify here for local dev and other exposures. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing bearer token');
  }

  const env = getEnv();
  const token = header.slice('Bearer '.length);

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `https://${env.AUTH0_DOMAIN}/`,
      audience: env.AUTH0_AUDIENCE,
    });

    if (!payload.sub) {
      throw ApiError.unauthorized('Token has no subject claim');
    }

    c.set('auth', payload as unknown as Auth0Claims);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid or expired token');
  }

  await next();
});

/** Auth0 owns identity, we own profile; lazy creation avoids a user with no row. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.get('auth');
  const db = c.get('db');

  const existing = await db.select().from(users).where(eq(users.auth0Sub, auth.sub)).limit(1);

  let user = existing[0];
  if (!user) {
    try {
      const inserted = await db
        .insert(users)
        .values({
          auth0Sub: auth.sub,
          username: buildPlaceholderUsername(auth),
          email: auth.email ?? null,
          avatarUrl: auth.picture ?? null,
        })
        .returning();
      user = inserted[0];
    } catch (error) {
      // Two first requests can insert the same account. Keep the row that won.
      if (isUniqueViolation(error)) {
        const again = await db.select().from(users).where(eq(users.auth0Sub, auth.sub)).limit(1);
        user = again[0];
      }
      if (!user) throw error;
    }
  }

  if (!user) {
    throw new ApiError('internal_error', 'Could not resolve the current user');
  }

  c.set('user', user);
  await next();
});

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.header('authorization')?.startsWith('Bearer ')) {
    try {
      await requireAuth(c, async () => {
        await requireUser(c, async () => {});
      });
    } catch {
      // Invalid token: continue as an anonymous visitor.
    }
  }
  await next();
});

function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    return (candidate as { code?: unknown }).code === '23505';
  });
}

/** Placeholder only; unique subject suffix prevents signup races before the welcome rename. */
function buildPlaceholderUsername(auth: Auth0Claims): string {
  const base = slugify(auth.email?.split('@')[0] ?? auth.name ?? 'trader').replace(/-/g, '_');
  const suffix = auth.sub
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toLowerCase();
  return `${base || 'trader'}_${suffix}`.slice(0, 30);
}
