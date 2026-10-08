import type { Database } from '@opulent/db';
import { places } from '@opulent/db';
import type { PlaceRef } from '@opulent/shared';
import { and, asc, eq, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';

export interface PlacePoint extends PlaceRef {
  latitude: number;
  longitude: number;
}

/** One city, including the coordinates radius search needs and the client does not. */
export async function getPlace(db: Database, geonameId: number): Promise<PlacePoint | undefined> {
  const rows = await db
    .select({
      geonameId: places.geonameId,
      label: places.label,
      latitude: places.latitude,
      longitude: places.longitude,
    })
    .from(places)
    .where(eq(places.geonameId, geonameId))
    .limit(1);
  return rows[0];
}

/**
 * Cities that match what the user typed, largest first.
 *
 * One word matches the start of the city name ("aus" means Austin). Commas
 * add the state and then the country, in that order: "Austin, Texas" or
 * "Austin, Texas, United States". A two-part phrase may also be the city and
 * the country, so "Paris, France" still works. A short state code such as
 * "TX" matches too.
 */
export async function searchPlaces(db: Database, term: string, limit = 8): Promise<PlaceRef[]> {
  const exact = term.trim().toLowerCase();
  const [city, state, country] = placeParts(exact);
  if (!city) return [];

  const cityPrefix = likePrefix(city);
  const filters = [
    or(
      sql`lower(${places.name}) like ${cityPrefix} escape '\\'`,
      sql`lower(${places.asciiName}) like ${cityPrefix} escape '\\'`,
    ),
  ];

  if (state && country) {
    filters.push(matchesRegion(places.admin1Name, places.admin1Code, state));
    filters.push(matchesRegion(places.countryName, places.countryCode, country));
  } else if (state) {
    filters.push(
      or(
        matchesRegion(places.admin1Name, places.admin1Code, state),
        matchesRegion(places.countryName, places.countryCode, state),
      ),
    );
  }

  return db
    .select({
      geonameId: places.geonameId,
      label: places.label,
    })
    .from(places)
    .where(and(...filters))
    .orderBy(
      sql`case
        when lower(${places.label}) = ${exact} then 0
        when lower(${places.name}) = ${city} or lower(${places.asciiName}) = ${city} then 1
        else 2
      end`,
      sql`${places.population} desc`,
      asc(places.label),
    )
    .limit(limit);
}

/** "Austin, Texas, United States" becomes the city, the state, and the country. */
function placeParts(term: string): [string, string | undefined, string | undefined] {
  const parts = term
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return [parts[0] ?? '', parts[1], parts[2]];
}

function likePrefix(value: string): string {
  return `${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** The start of a region name, or its short code, such as Texas or TX. */
function matchesRegion(name: AnyColumn, code: AnyColumn, value: string): SQL {
  const prefix = likePrefix(value);
  return or(
    sql`lower(${name}) like ${prefix} escape '\\'`,
    sql`lower(${code}) = ${value}`,
  ) as SQL;
}
