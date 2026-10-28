import type { Database, UserRow } from '@opulent/db';
import { collectionItems, friendships, users, wantLists } from '@opulent/db';
import type {
  CompleteOnboardingInput,
  Friend,
  NearbyUser,
  Profile,
  UpdateProfileInput,
  UsernameAvailability,
} from '@opulent/shared';
import { CARD_GAME, reservedUsernames, usernameSchema } from '@opulent/shared';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { getPlace } from '../places/service';
import { listGenericWants } from '../wants/service';

export async function getUserByUsername(
  db: Database,
  username: string,
): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0];
}

/** Availability is advice, not a reservation; the write path handles the race. */
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

/** One-time onboarding; the stamp closes it for good, so a second run is refused. */
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
    ...(input.tradeBinderVisibility !== undefined
      ? { tradeBinderVisibility: input.tradeBinderVisibility }
      : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
  });
}

export interface RadiusOrigin {
  latitude: number;
  longitude: number;
}

/** Radius search in meters on geography; returns distance, never other users' coordinates. */
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

/** Single write; the unique username index wins any race and maps to a conflict. */
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

/** Shared copy filters; SQL expects aliases w, c, and bi. */
export function copyScope() {
  return sql`
    AND (cardinality(w.wanted_languages) = 0 OR c.lang = ANY(w.wanted_languages))
    AND (cardinality(w.wanted_finishes) = 0 OR bi.finish::text = ANY(w.wanted_finishes))
    AND (cardinality(w.wanted_conditions) = 0 OR bi.condition::text = ANY(w.wanted_conditions))
    AND (cardinality(w.wanted_sets) = 0 OR lower(c.set_code) = ANY(w.wanted_sets))
  `;
}

function wantMatchSql(ownerId: string, viewerId: string) {
  return sql`
    SELECT wl.slug AS slug, GROUPING(wl.slug) AS "isTotal", COUNT(DISTINCT w.id)::int AS "matchCount"
    FROM want_items w
    JOIN want_list_items wli ON wli.want_item_id = w.id AND wli.user_id = w.user_id
    JOIN want_lists wl ON wl.id = wli.want_list_id
    JOIN cards c ON c.oracle_id = w.oracle_id
    JOIN collection_items bi ON bi.scryfall_id = c.scryfall_id
    WHERE w.user_id = ${ownerId}
      AND wl.user_id = ${ownerId}
      AND wl.visibility = 'public'
      AND bi.user_id = ${viewerId}
      AND c.game = ${CARD_GAME}
      AND bi.for_trade = true
      ${copyScope()}
    GROUP BY GROUPING SETS ((wl.slug), ())
  `;
}

async function matchCountsBySlug(db: Database, query: ReturnType<typeof wantMatchSql>) {
  const rows = (await db.execute(query)) as unknown as {
    slug: string | null;
    isTotal: number | string;
    matchCount: number | string;
  }[];
  const bySlug = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const value = Number(row.matchCount);
    if (Number(row.isTotal) === 1) total = value;
    else if (row.slug && value > 0) bySlug.set(row.slug, value);
  }
  return { bySlug, total };
}

async function countTradeBinder(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)::int` })
    .from(collectionItems)
    .where(and(eq(collectionItems.userId, userId), eq(collectionItems.forTrade, true)));
  return Number(rows[0]?.total ?? 0);
}

function withMatchCounts<T extends { slug: string }>(
  entries: T[],
  bySlug: Map<string, number> | undefined,
) {
  if (!bySlug) return entries;
  return entries.map((entry) => {
    const matchCount = bySlug.get(entry.slug) ?? 0;
    return matchCount > 0 ? { ...entry, matchCount } : entry;
  });
}

async function listedEntries(db: Database, userId: string, table: typeof wantLists) {
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

/** Profile page; a private profile hides want lists from everyone, including the owner. */
export async function getProfile(
  db: Database,
  username: string,
  viewerId?: string,
): Promise<Profile> {
  const user = await getUserByUsername(db, username);
  if (!user) throw ApiError.notFound('User not found');

  const place = user.placeId === null ? undefined : await getPlace(db, user.placeId);
  const isOwner = viewerId === user.id;
  const isFollowing = viewerId ? await viewerAddedFriend(db, viewerId, user.id) : false;
  const profile: Profile = {
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    city: place ? { geonameId: place.geonameId, label: place.label } : null,
    visibility: user.profileVisibility,
    isOwner,
    isFollowing,
    followerCount: await countFollowers(db, user.id),
    followingCount: await countFollowing(db, user.id),
  };
  if (user.profileVisibility !== 'public') return profile;

  const wantEntries = await listedEntries(db, user.id, wantLists);
  const viewerCanMatch = viewerId !== undefined && viewerId !== user.id;
  const tradeBinderOpen = user.tradeBinderVisibility === 'public';
  const wantMatches = viewerCanMatch
    ? await matchCountsBySlug(db, wantMatchSql(user.id, viewerId))
    : undefined;

  return {
    ...profile,
    ...(tradeBinderOpen || isOwner
      ? { tradeBinderCount: await countTradeBinder(db, user.id) }
      : {}),
    ...(wantMatches && wantMatches.total > 0 ? { wantMatchCount: wantMatches.total } : {}),
    wantLists: withMatchCounts(wantEntries, wantMatches?.bySlug),
    genericWants: await listGenericWants(db, user.id),
  };
}

async function countFollowers(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(friendships)
    .where(eq(friendships.friendId, userId));
  return Number(row?.value ?? 0);
}

async function countFollowing(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(friendships)
    .where(eq(friendships.userId, userId));
  return Number(row?.value ?? 0);
}

export async function viewerAddedFriend(
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

export async function listFollowing(db: Database, username: string): Promise<Friend[]> {
  const user = await getUserByUsername(db, username);
  if (!user) throw ApiError.notFound('User not found');
  return listFriends(db, user.id);
}

export async function listFollowers(db: Database, username: string): Promise<Friend[]> {
  const user = await getUserByUsername(db, username);
  if (!user) throw ApiError.notFound('User not found');
  const follower = users;
  return db
    .select({
      username: follower.username,
      avatarUrl: follower.avatarUrl,
    })
    .from(friendships)
    .innerJoin(follower, eq(follower.id, friendships.userId))
    .where(eq(friendships.friendId, user.id))
    .orderBy(asc(follower.username));
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
  if (friend.id === userId) throw ApiError.badRequest('You cannot follow yourself');

  try {
    await db.insert(friendships).values({ userId, friendId: friend.id });
  } catch (error) {
    if (isDuplicateFriend(error)) throw ApiError.conflict('You already follow that person');
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
  if (!removed[0]) throw ApiError.notFound('You do not follow that person');
}
