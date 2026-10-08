import { zValidator } from '@hono/zod-validator';
import {
  completeOnboardingSchema,
  nearbyQuerySchema,
  updateProfileSchema,
  usernameSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, requireUser } from '../../middleware/auth';
import type { AppEnv } from '../../lib/context';
import { ApiError } from '../../lib/http';
import type { Database, UserRow } from '@opulent/db';
import { getPlace } from '../places/service';
import {
  checkUsernameAvailability,
  completeOnboarding,
  findUsersWithinRadius,
  getUserByUsername,
  updateProfile,
} from './service';

export const userRoutes = new Hono<AppEnv>();

function toPublicUser(user: {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

async function toMe(db: Database, user: UserRow) {
  const place = user.placeId === null ? undefined : await getPlace(db, user.placeId);
  return {
    ...toPublicUser(user),
    auth0Sub: user.auth0Sub,
    email: user.email,
    city: place ? { geonameId: place.geonameId, label: place.label } : null,
    onboarded: user.onboardedAt !== null,
  };
}

userRoutes.get('/me', requireAuth, requireUser, async (c) =>
  c.json(await toMe(c.get('db'), c.get('user'))),
);

/**
 * The one-time welcome screen. Separate from PATCH so the two moments stay
 * distinct: here the user picks freely, and afterwards a rename is a trip to
 * profile settings rather than something they can wander into.
 */
userRoutes.post(
  '/me/onboarding',
  requireAuth,
  requireUser,
  zValidator('json', completeOnboardingSchema),
  async (c) => {
    const user = await completeOnboarding(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(await toMe(c.get('db'), user));
  },
);

/** Live feedback for the welcome screen, so a taken username is seen before saving. */
userRoutes.get(
  '/me/username-available',
  requireAuth,
  requireUser,
  zValidator('query', z.object({ username: z.string() })),
  async (c) => {
    const result = await checkUsernameAvailability(
      c.get('db'),
      c.req.valid('query').username,
      c.get('user').id,
    );
    return c.json(result);
  },
);

userRoutes.patch(
  '/me',
  requireAuth,
  requireUser,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const updated = await updateProfile(c.get('db'), c.get('user').id, c.req.valid('json'));
    return c.json(await toMe(c.get('db'), updated));
  },
);

/**
 * Users whose saved city is inside the radius. Registered before `/:username`
 * so the word "nearby" is this search and not somebody's name.
 */
userRoutes.get(
  '/nearby',
  requireAuth,
  requireUser,
  zValidator('query', nearbyQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const caller = c.get('user');
    let latitude = query.latitude;
    let longitude = query.longitude;

    if (latitude === undefined || longitude === undefined) {
      const place =
        caller.placeId === null ? undefined : await getPlace(c.get('db'), caller.placeId);
      if (!place) {
        throw ApiError.badRequest('Save a city, or pass your current location');
      }
      latitude = place.latitude;
      longitude = place.longitude;
    }

    const items = await findUsersWithinRadius(
      c.get('db'),
      caller.id,
      { latitude, longitude },
      query.radiusMeters,
    );
    return c.json({ items });
  },
);

/** Public profile lookup, used by the share page to render the owner's username. */
userRoutes.get(
  '/:username',
  zValidator('param', z.object({ username: usernameSchema })),
  async (c) => {
    const user = await getUserByUsername(c.get('db'), c.req.valid('param').username);
    if (!user) throw ApiError.notFound('User not found');
    return c.json(toPublicUser(user));
  },
);
