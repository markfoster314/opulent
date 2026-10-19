import type { Database, UserRow } from '@opulent/db';
import { binders, friendships, users, wantLists } from '@opulent/db';
import type {
  CompleteOnboardingInput,
  Friend,
  NearbyUser,
  Profile,
  UpdateProfileInput,
  UsernameAvailability,
} from '@opulent/shared';
import { reservedUsernames, usernameSchema } from '@opulent/shared';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { getPlace } from '../places/service';

export async function getUserByUsername(
  db: Database,
  username: string,
): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0];
}

/**
 * Answers the welcome screen's "is this username free?" as the user types.
 *
 * This is advice, not a reservation. Nothing stops two people from seeing
 * "available" for the same name at the same moment, which is why the write
 * path below still has to survive losing that race.
 */
export async function checkUsernameAvailability(
  db: Database,
  username: string,
  currentUserId: string,
): Promise<UsernameAvailability> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return {
      username: username.trim().toLowerCase(),
      available: false,
      reason: parsed.error.issues[0]?.message ?? 'That username cannot be used',
    };
  }

  const normalized = parsed.data;

  if (reservedUsernames.has(normalized)) {
    return { username: normalized, available: false, reason: 'That username is reserved' };
  }

  const taken = await findUsernameOwner(db, normalized, currentUserId);
  if (taken) {
    return { username: normalized, available: false, reason: 'That username is already taken' };
  }

  return { username: normalized, available: true, reason: null };
}

/**
 * The one-time welcome screen write.
 *
 * Stamping `onboardedAt` is what closes the screen for good, so this refuses to
 * run twice. Later changes go through `updateProfile`.
 */
export async function completeOnboarding(
  db: Database,
  userId: string,
  input: CompleteOnboardingInput,
): Promise<UserRow> {
  const current = await getUserById(db, userId);
  if (current.onboardedAt) {
    throw ApiError.conflict('You have already chosen your username');
  }

  await assertUsernameIsFree(db, input.username, userId);
  await assertPlaceExists(db, input.placeId);

  return writeUser(db, userId, {
    username: input.username,
    placeId: input.placeId ?? null,
    onboardedAt: new Date(),
  });
}

export async function updateProfile(
  db: Database,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserRow> {
  const current = await getUserById(db, userId);
  if (!current.onboardedAt) {
    throw ApiError.forbidden('Choose your username on the welcome screen first');
  }

  if (input.username !== undefined && input.username !== current.username) {
    await assertUsernameIsFree(db, input.username, userId);
  }
  await assertPlaceExists(db, input.placeId);

  return writeUser(db, userId, {
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
    ...(input.profileVisibility !== undefined
      ? { profileVisibility: input.profileVisibility }
      : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
  });
}

export interface RadiusOrigin {
  latitude: number;
  longitude: number;
}

/**
 * People whose saved city falls inside the radius.
 *
 * ST_DWithin on a geography column measures meters on the earth, so 80,000
 * means 80 kilometers. The caller's own row is left out, and the result carries
 * a distance rather than anyone else's coordinates.
 */
export async function findUsersWithinRadius(
  db: Database,
  callerId: string,
  origin: RadiusOrigin,
  radiusMeters: number,
): Promise<NearbyUser[]> {
  const result = await db.execute<{
    username: string;
    city: string;
    distance_meters: number | string;
  }>(sql`
    SELECT u.username,
           p.label AS city,
           ST_Distance(
             p.location,
             ST_SetSRID(ST_MakePoint(${origin.longitude}, ${origin.latitude}), 4326)::geography
           ) AS distance_meters
    FROM users u
    JOIN places p ON p.geoname_id = u.place_id
    WHERE u.id::text <> ${callerId}
      AND u.onboarded_at IS NOT NULL
      AND ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(${origin.longitude}, ${origin.latitude}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_meters
    LIMIT 50
  `);

  return [...result].map((row) => ({
    username: row.username,
    city: row.city,
    distanceMeters: Math.round(Number(row.distance_meters)),
  }));
}

async function assertPlaceExists(db: Database, placeId: number | null | undefined): Promise<void> {
  if (placeId == null) return;
  const place = await getPlace(db, placeId);
  if (!place) throw ApiError.badRequest('Choose a city from the list');
}

async function getUserById(db: Database, userId: string): Promise<UserRow> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function findUsernameOwner(
  db: Database,
  username: string,
  excludeUserId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, excludeUserId)))
    .limit(1);
  return rows.length > 0;
}

async function assertUsernameIsFree(db: Database, username: string, userId: string): Promise<void> {
  if (reservedUsernames.has(username)) {
    throw ApiError.conflict('That username is reserved');
  }
  if (await findUsernameOwner(db, username, userId)) {
    throw ApiError.conflict('That username is already taken');
  }
}

/**
 * The single write, wrapped so the database has the last word.
 *
 * The check above can lose a race with two people claiming one username in the
 * same instant. `users_username_key` cannot, so its rejection is translated
 * into the same conflict the caller would have seen a moment earlier.
 */
async function writeUser(
  db: Database,
  userId: string,
  values: Partial<typeof users.$inferInsert>,
): Promise<UserRow> {
  try {
    const updated = await db
      .update(users)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    const user = updated[0];
    if (!user) throw ApiError.notFound('User not found');
    return user;
  } catch (error) {
    if (isUsernameCollision(error)) {
      throw ApiError.conflict('That username was taken a moment ago. Please pick another.');
    }
    throw error;
  }
}

/** Postgres reports a broken unique index as SQLSTATE 23505. */
function isUsernameCollision(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; constraint_name?: unknown };
  return candidate.code === '23505' && candidate.constraint_name === 'users_username_key';
}

function isDuplicateFriend(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'friendships_pair_key';
  });
}

async function listedEntries(
  db: Database,
  userId: string,
  table: typeof binders | typeof wantLists,
) {
  return db
    .select({
      slug: table.slug,
      name: table.name,
      description: table.description,
    })
    .from(table)
    .where(and(eq(table.userId, userId), eq(table.visibility, 'public')))
    .orderBy(asc(table.name));
}

/** The page at /u/:username. A private page hides the lists from everyone except the owner. */
export async function getProfile(
  db: Database,
  username: string,
  viewerId?: string,
): Promise<Profile> {
  const user = await getUserByUsername(db, username);
  if (!user) throw ApiError.notFound('User not found');

  const isOwner = viewerId === user.id;
  const isFriend = viewerId ? await viewerAddedFriend(db, viewerId, user.id) : false;
  const profile: Profile = {
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    visibility: user.profileVisibility,
    isOwner,
    isFriend,
    friendCount: await countFriends(db, user.id),
  };
  if (!isOwner && user.profileVisibility !== 'public') return profile;

  return {
    ...profile,
    binders: await listedEntries(db, user.id, binders),
    wantLists: await listedEntries(db, user.id, wantLists),
  };
}

async function countFriends(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(friendships)
    .where(eq(friendships.userId, userId));
  return Number(row?.value ?? 0);
}

async function viewerAddedFriend(
  db: Database,
  viewerId: string,
  friendId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userId, viewerId), eq(friendships.friendId, friendId)))
    .limit(1);
  return rows.length > 0;
}

export async function listFriends(db: Database, userId: string): Promise<Friend[]> {
  const friend = users;
  return db
    .select({
      username: friend.username,
      avatarUrl: friend.avatarUrl,
    })
    .from(friendships)
    .innerJoin(friend, eq(friend.id, friendships.friendId))
    .where(eq(friendships.userId, userId))
    .orderBy(asc(friend.username));
}

export async function addFriend(db: Database, userId: string, username: string): Promise<Friend> {
  const friend = await getUserByUsername(db, username);
  if (!friend) throw ApiError.notFound('No one uses that username');
  if (friend.id === userId) throw ApiError.badRequest('You cannot add yourself');

  try {
    await db.insert(friendships).values({ userId, friendId: friend.id });
  } catch (error) {
    if (isDuplicateFriend(error)) throw ApiError.conflict('You already added that friend');
    throw error;
  }

  return { username: friend.username, avatarUrl: friend.avatarUrl };
}

export async function removeFriend(db: Database, userId: string, username: string): Promise<void> {
  const friend = await getUserByUsername(db, username);
  if (!friend) throw ApiError.notFound('No one uses that username');

  const removed = await db
    .delete(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friend.id)))
    .returning({ id: friendships.id });
  if (!removed[0]) throw ApiError.notFound('That person is not on your friends list');
}
