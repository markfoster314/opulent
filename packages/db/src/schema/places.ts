import { doublePrecision, integer, pgTable, text } from 'drizzle-orm/pg-core';

/** Cities from the GeoNames cities5000 dump; the generated PostGIS location column is added in bootstrap because drizzle cannot model it. */
export const places = pgTable('places', {
  /** GeoNames id; stable across dumps, so a re-sync updates the same row. */
  geonameId: integer('geoname_id').primaryKey(),

  name: text('name').notNull(),
  asciiName: text('ascii_name').notNull(),
  countryCode: text('country_code').notNull(),
  countryName: text('country_name').notNull(),
  admin1Code: text('admin1_code').notNull().default(''),
  admin1Name: text('admin1_name').notNull().default(''),

  /** Picker text, such as "Austin, Texas, United States". */
  label: text('label').notNull(),

  population: integer('population').notNull().default(0),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
});

export type PlaceRow = typeof places.$inferSelect;
export type NewPlaceRow = typeof places.$inferInsert;
