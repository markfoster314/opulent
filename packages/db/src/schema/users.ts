import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { binderVisibility, profileVisibility } from './enums';
import { places } from './places';

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** The immutable Auth0 subject claim, such as `auth0|65f...`; the only link to the identity provider, and we store no password. */
    auth0Sub: text('auth0_sub').notNull(),

    /** The one name a user has: shown to others and used as the /u/ segment, so no second display name can drift. */
    username: text('username').notNull(),

    email: text('email'),
    avatarUrl: text('avatar_url'),

    bio: text('bio'),

    /** Private: only this person can open /u/:username; public: anyone can, and sees the binder and want lists. */
    profileVisibility: profileVisibility('profile_visibility').notNull().default('private'),

    /** Private: owner only; unlisted: anyone with the share token; public: anyone, and listed on the profile. */
    tradeBinderVisibility: binderVisibility('trade_binder_visibility').notNull().default('private'),
    /** Secret second door to an unlisted trade binder. Rotating it revokes old links. */
    tradeBinderShareToken: text('trade_binder_share_token')
      .notNull()
      .default(sql`encode(gen_random_bytes(16), 'hex')`),

    /** Optional GeoNames city; kept out of public profile responses, and radius search reads the place's coordinates, not this row. */
    placeId: integer('place_id').references(() => places.geonameId, { onDelete: 'set null' }),

    /** Null while the username is still the generated placeholder; a time beats a flag because it also measures how long signup took. */
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_auth0_sub_key').on(table.auth0Sub),
    uniqueIndex('users_username_key').on(table.username),
    uniqueIndex('users_trade_binder_share_token_key').on(table.tradeBinderShareToken),
    index('users_place_id_idx').on(table.placeId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/** Directed, not mutual: each side has its own row, and removing one drops only that side. */
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    friendId: uuid('friend_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('friendships_pair_key').on(table.userId, table.friendId),
    index('friendships_friend_id_idx').on(table.friendId),
  ],
);

export type FriendshipRow = typeof friendships.$inferSelect;
export type NewFriendshipRow = typeof friendships.$inferInsert;
