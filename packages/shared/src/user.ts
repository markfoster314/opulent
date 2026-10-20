import { z } from 'zod';
import { profileVisibilitySchema } from './enums';
import { placeIdSchema, placeRefSchema } from './place';
import { genericWantSchema } from './want';

/**
 * Usernames that must never belong to a person.
 *
 * A username is the first segment after `/u/`, and it is also the word a future
 * top-level route could want. Letting someone register `admin` or `binders`
 * makes their profile indistinguishable from a page we own.
 */
export const reservedUsernames = new Set([
  'about',
  'account',
  'admin',
  'api',
  'auth',
  'binder',
  'binders',
  'card',
  'cards',
  'help',
  'login',
  'logout',
  'me',
  'new',
  'opulent',
  'opulenttutor',
  'privacy',
  'profile',
  'root',
  'settings',
  'signin',
  'signup',
  'support',
  'system',
  'terms',
  'trade',
  'trades',
  'u',
  'user',
  'users',
  'want',
  'wants',
  'welcome',
]);

export function isReservedUsername(username: string): boolean {
  return reservedUsernames.has(username.trim().toLowerCase());
}

/**
 * The shape of a username, used for reading as well as writing.
 *
 * Case is folded before the rule runs rather than rejected by it. Someone
 * typing `Mark` means `mark`, and the computer already knows that, so turning
 * it into an error would be busywork. A space or a `!` still fails, because
 * there is no single obvious correction for those.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(3, 'Use at least 3 characters')
      .max(30, 'Use at most 30 characters')
      .regex(/^[a-z0-9_]+$/, 'Use letters, numbers and underscores only, with no spaces'),
  );

/**
 * A username somebody is trying to claim. Reading an existing one uses
 * `usernameSchema`, so a reserved word in a URL is a miss rather than a refusal.
 */
export const claimedUsernameSchema = usernameSchema.refine(
  (username) => !reservedUsernames.has(username),
  'That username is reserved',
);

/**
 * One name does both jobs: it is what people see, and it is the `/u/` segment
 * in every share link. There is no separate display name to keep in step.
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  username: usernameSchema,
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** The caller's own record, which may include fields other users never see. */
export const meSchema = userSchema.extend({
  auth0Sub: z.string(),
  email: z.string().email().nullable(),
  /** Null until the user picks a city. Other people do not receive this. */
  city: placeRefSchema.nullable(),
  /** False until the user has picked their own username on the welcome screen. */
  onboarded: z.boolean(),
  profileVisibility: profileVisibilitySchema,
  bio: z.string().nullable(),
});
export type Me = z.infer<typeof meSchema>;

/** The welcome screen, shown once. City may be left blank. */
export const completeOnboardingSchema = z.object({
  username: claimedUsernameSchema,
  placeId: placeIdSchema.nullable().optional(),
});
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

/** How long a profile bio may be. The page shows the same limit while typing. */
export const BIO_MAX_LENGTH = 280;

export const bioSchema = z
  .string()
  .trim()
  .max(BIO_MAX_LENGTH, `Use at most ${BIO_MAX_LENGTH} characters`)
  .transform((value) => (value.length === 0 ? null : value));

export const updateProfileSchema = z
  .object({
    username: claimedUsernameSchema.optional(),
    placeId: placeIdSchema.nullable().optional(),
    profileVisibility: profileVisibilitySchema.optional(),
    bio: bioSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.placeId !== undefined ||
      value.profileVisibility !== undefined ||
      value.bio !== undefined,
    'Nothing to save',
  );
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Who is within a radius of a point.
 *
 * Pass both coordinates to search from the browser's current location. Omit
 * both to search from the caller's saved city. The answer is a distance, never
 * another user's coordinates.
 */
export const nearbyQuerySchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusMeters: z.coerce.number().int().min(1_000).max(500_000).default(80_000),
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    'Pass both latitude and longitude, or neither',
  );
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

export const nearbyUserSchema = z.object({
  username: z.string(),
  city: z.string(),
  distanceMeters: z.number().int().nonnegative(),
});
export type NearbyUser = z.infer<typeof nearbyUserSchema>;

export const usernameAvailabilitySchema = z.object({
  username: z.string(),
  available: z.boolean(),
  /** Why not, in words the form can show directly. Null when available. */
  reason: z.string().nullable(),
});
export type UsernameAvailability = z.infer<typeof usernameAvailabilitySchema>;

const profileEntrySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Cards in this list that overlap with the signed-in viewer. Omitted for the owner. */
  matchCount: z.number().int().nonnegative().optional(),
});

/** What /u/:username shows. A private page leaves the lists off for everyone. */
export const profileSchema = z.object({
  username: usernameSchema,
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  city: placeRefSchema.nullable(),
  visibility: profileVisibilitySchema,
  isOwner: z.boolean(),
  /** True when the viewer follows this person. */
  isFollowing: z.boolean(),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  /** Matches across every public binder. Omitted for the owner and for signed-out visitors. */
  binderMatchCount: z.number().int().nonnegative().optional(),
  /** Matches across every public want list. Omitted for the owner and for signed-out visitors. */
  wantMatchCount: z.number().int().nonnegative().optional(),
  binders: z.array(profileEntrySchema).optional(),
  wantLists: z.array(profileEntrySchema).optional(),
  genericWants: z.array(genericWantSchema).optional(),
});
export type Profile = z.infer<typeof profileSchema>;

export const friendSchema = z.object({
  username: usernameSchema,
  avatarUrl: z.string().url().nullable(),
});
export type Friend = z.infer<typeof friendSchema>;

export const addFriendSchema = z.object({
  username: usernameSchema,
});
export type AddFriendInput = z.infer<typeof addFriendSchema>;
