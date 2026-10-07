import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /**
     * The immutable Auth0 subject claim, for example `auth0|65f...`.
     * This is the only link between our row and the identity provider.
     * We never store a password.
     */
    auth0Sub: text('auth0_sub').notNull(),

    /** Public, user-chosen name used in share URLs such as /u/mark. */
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_auth0_sub_key').on(table.auth0Sub),
    uniqueIndex('users_handle_key').on(table.handle),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
