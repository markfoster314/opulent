import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { places } from './places';

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

    /**
     * The one name a user has. It is shown to other people and it is also the
     * `/u/` segment in every share link, so there is no second display name
     * that could drift out of step with it.
     */
    username: text('username').notNull(),

    email: text('email'),
    avatarUrl: text('avatar_url'),

    /**
     * Optional city, chosen from the GeoNames list. Null means they skipped it.
     * Kept off public profile responses so a share link does not publish it.
     * Radius search reads the coordinates from the place, not from this row.
     */
    placeId: integer('place_id').references(() => places.geonameId, { onDelete: 'set null' }),

    /**
     * When the user picked their own username on the welcome screen.
     *
     * Null means the username is still the generated placeholder from first
     * login, so the web app has not asked them yet. The column holds a time
     * rather than a boolean because "when did they choose" answers questions a
     * flag cannot, such as how long people wait before finishing signup.
     */
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_auth0_sub_key').on(table.auth0Sub),
    uniqueIndex('users_username_key').on(table.username),
    index('users_place_id_idx').on(table.placeId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
