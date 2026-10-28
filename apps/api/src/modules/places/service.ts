import type { Database } from '@opulent/db';
import { places } from '@opulent/db';
import type { PlaceRef } from '@opulent/shared';
import { and, asc, eq, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';

export interface PlacePoint extends PlaceRef {
  latitude: number;
  longitude: number;
}

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

/** Prefix match; comma parts add state then country, and short codes like TX work. */
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

function matchesRegion(name: AnyColumn, code: AnyColumn, value: string): SQL {
  const prefix = likePrefix(value);
  return or(sql`lower(${name}) like ${prefix} escape '\\'`, sql`lower(${code}) = ${value}`) as SQL;
}
