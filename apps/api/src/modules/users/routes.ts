import { zValidator } from '../../lib/validate';
import {
  addFriendSchema,
  collectionItemQuerySchema,
  completeOnboardingSchema,
  nearbyQuerySchema,
  updateProfileSchema,
  usernameSchema,
} from '@opulent/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, requireUser, optionalAuth } from '../../middleware/auth';
import type { AppEnv } from '../../lib/context';
import { ApiError } from '../../lib/http';
import type { Database, UserRow } from '@opulent/db';
import { getPlace } from '../places/service';
import {
  assertCanViewTradeBinder,
  findTradeBinderMatches,
  getTradeBinder,
  listTradeBinderItems,
  rotateTradeBinderToken,
} from '../collection/service';
import {
  checkUsernameAvailability,
  completeOnboarding,
  findUsersWithinRadius,
  addFriend,
  getProfile,
  getUserByUsername,
  listFriends,
  listFollowers,
  listFollowing,
  removeFriend,
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
    profileVisibility: user.profileVisibility,
    bio: user.bio,
    tradeBinderVisibility: user.tradeBinderVisibility,
    tradeBinderShareToken: user.tradeBinderShareToken,
  };
}

const handleParam = z.object({ username: usernameSchema });

async function tradeBinderOwner(db: Database, username: string) {
  const owner = await getUserByUsername(db, username);
  if (!owner) throw ApiError.notFound('User not found');
  return owner;
}

userRoutes.get('/me', requireAuth, requireUser, async (c) =>
  c.json(await toMe(c.get('db'), c.get('user'))),
);

/** One-time welcome rename stays separate from later profile edits. */
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

/** Live feedback so a taken username is seen before saving. */
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

/** New secret invalidates every old trade binder link. */
userRoutes.post('/me/trade-binder/share-token/rotate', requireAuth, requireUser, async (c) => {
  return c.json({ shareToken: await rotateTradeBinderToken(c.get('db'), c.get('user').id) });
});

userRoutes.get('/me/friends', requireAuth, requireUser, async (c) => {
  const items = await listFriends(c.get('db'), c.get('user').id);
  return c.json({ items });
});

userRoutes.post(
  '/me/friends',
  requireAuth,
  requireUser,
  zValidator('json', addFriendSchema),
  async (c) => {
    const friend = await addFriend(c.get('db'), c.get('user').id, c.req.valid('json').username);
    return c.json(friend, 201);
  },
);

userRoutes.delete(
  '/me/friends/:username',
  requireAuth,
  requireUser,
  zValidator('param', z.object({ username: usernameSchema })),
  async (c) => {
    await removeFriend(c.get('db'), c.get('user').id, c.req.valid('param').username);
    return c.body(null, 204);
  },
);

/** Registered before /:username so "nearby" is not treated as a username. */
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

userRoutes.get(
  '/:username/trade-binder',
  optionalAuth,
  zValidator('param', handleParam),
  async (c) => {
    const db = c.get('db');
    const owner = await tradeBinderOwner(db, c.req.valid('param').username);
    const viewer = { userId: c.get('user')?.id, shareToken: c.req.query('t') };
    return c.json(await getTradeBinder(db, owner, viewer));
  },
);

userRoutes.get(
  '/:username/trade-binder/items',
  optionalAuth,
  zValidator('param', handleParam),
  zValidator('query', collectionItemQuerySchema),
  async (c) => {
    const db = c.get('db');
    const owner = await tradeBinderOwner(db, c.req.valid('param').username);
    const viewerId = c.get('user')?.id;
    assertCanViewTradeBinder(owner, { userId: viewerId, shareToken: c.req.query('t') });
    return c.json(await listTradeBinderItems(db, owner.id, c.req.valid('query'), viewerId));
  },
);

userRoutes.get(
  '/:username/trade-binder/matches',
  requireAuth,
  requireUser,
  zValidator('param', handleParam),
  async (c) => {
    const db = c.get('db');
    const owner = await tradeBinderOwner(db, c.req.valid('param').username);
    const viewer = c.get('user');
    assertCanViewTradeBinder(owner, { userId: viewer.id, shareToken: c.req.query('t') });
    if (owner.id === viewer.id) {
      throw ApiError.badRequest('Matching your want list against your own cards is not useful');
    }
    return c.json({ items: await findTradeBinderMatches(db, owner.id, viewer.id) });
  },
);

userRoutes.get(
  '/:username/following',
  optionalAuth,
  zValidator('param', z.object({ username: usernameSchema })),
  async (c) => {
    const items = await listFollowing(
      c.get('db'),
      c.req.valid('param').username,
      c.get('user')?.id,
    );
    return c.json({ items });
  },
);

userRoutes.get(
  '/:username/followers',
  optionalAuth,
  zValidator('param', z.object({ username: usernameSchema })),
  async (c) => {
    const items = await listFollowers(
      c.get('db'),
      c.req.valid('param').username,
      c.get('user')?.id,
    );
    return c.json({ items });
  },
);

/** Private profiles hide lists from everyone except the owner. */
userRoutes.get(
  '/:username',
  optionalAuth,
  zValidator('param', z.object({ username: usernameSchema })),
  async (c) => {
    const profile = await getProfile(c.get('db'), c.req.valid('param').username, c.get('user')?.id);
    return c.json(profile);
  },
);
