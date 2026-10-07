import { zValidator } from '@hono/zod-validator';
import { handleSchema, updateProfileSchema } from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, requireUser } from '../../middleware/auth';
import type { AppEnv } from '../../lib/context';
import { ApiError } from '../../lib/http';
import { getUserByHandle, updateProfile } from './service';

export const userRoutes = new Hono<AppEnv>();

function toPublicUser(user: {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

userRoutes.get('/me', requireAuth, requireUser, (c) => {
  const user = c.get('user');
  return c.json({ ...toPublicUser(user), auth0Sub: user.auth0Sub, email: user.email });
});

userRoutes.patch(
  '/me',
  requireAuth,
  requireUser,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const updated = await updateProfile(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(toPublicUser(updated));
  },
);

/** Public profile lookup, used by the share page to render the owner's name. */
userRoutes.get('/:handle', zValidator('param', z.object({ handle: handleSchema })), async (c) => {
  const user = await getUserByHandle(c.get('db'), c.req.valid('param').handle);
  if (!user) throw ApiError.notFound('User not found');
  return c.json(toPublicUser(user));
});
