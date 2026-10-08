import { users } from '@opulent/db';
import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getEnv } from '../env';
import type { AppEnv, Auth0Claims } from '../lib/context';
import { ApiError, slugify } from '../lib/http';

/**
 * Auth0's public signing keys. jose caches and refreshes these for us, so this
 * must stay module-level: rebuilding it per request would refetch the key set.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  if (!jwks) {
    const { AUTH0_DOMAIN } = getEnv();
    jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Checks the hand stamp. In production Amazon API Gateway already rejects bad
 * tokens before we run, but verifying here too keeps local development honest
 * and protects us if the API is ever exposed another way.
 */
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

/**
 * Maps the Auth0 subject to our own users row, creating it on first sight.
 *
 * Auth0 owns identity; we own the profile. Provisioning here rather than with a
 * signup webhook means there is no window where a logged-in user has no row.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.get('auth');
  const db = c.get('db');

  const existing = await db.select().from(users).where(eq(users.auth0Sub, auth.sub)).limit(1);

  let user = existing[0];
  if (!user) {
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
  }

  if (!user) {
    throw new ApiError('internal_error', 'Could not resolve the current user');
  }

  c.set('user', user);
  await next();
});

/**
 * For routes that behave differently when signed in but must still serve
 * anonymous visitors, such as opening a public binder. A bad token is treated
 * as no token rather than as an error.
 */
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.header('authorization')?.startsWith('Bearer ')) {
    try {
      await requireAuth(c, async () => {
        await requireUser(c, async () => {});
      });
    } catch {
      // Fall through as an anonymous visitor.
    }
  }
  await next();
});

/**
 * A stand-in username, never shown to the user.
 *
 * The column is unique and not null, so the row needs some value the moment it
 * is created. The welcome screen replaces this before the user can reach any
 * page that would display it. The suffix comes from the Auth0 subject, which is
 * already unique, so two people signing up at once cannot collide.
 */
function buildPlaceholderUsername(auth: Auth0Claims): string {
  const base = slugify(auth.email?.split('@')[0] ?? auth.name ?? 'trader').replace(/-/g, '_');
  const suffix = auth.sub
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toLowerCase();
  return `${base || 'trader'}_${suffix}`.slice(0, 30);
}
