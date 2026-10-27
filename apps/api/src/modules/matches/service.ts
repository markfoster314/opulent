import type { Database } from '@opulent/db';
import { CARD_GAME, type MatchOwner } from '@opulent/shared';
import { sql } from 'drizzle-orm';
import { copyScope } from '../users/service';

interface MatchOwnerRow {
  username: string;
  city: string | null;
  distanceMeters: number | string | null;
  matchCount: number | string;
  cardNames: string[] | null;
}

/** How many card names ride along on each paper. */
const NAMES_PER_OWNER = 4;

/**
 * Who has what I want.
 *
 * One row per other person whose public trade binder holds a card on the
 * viewer's want lists. The copy rules (language, finish, condition, set) are
 * the same ones the binder match uses. Distance comes from the two saved
 * cities through PostGIS, so it is null when either side has no city.
 *
 * Sorted nearest first. People with no distance go last, then by count.
 */
export async function findMatchOwners(
  db: Database,
  viewerId: string,
  limit: number,
): Promise<MatchOwner[]> {
  const rows = (await db.execute(sql`
    WITH viewer AS (
      SELECT p.location
      FROM users u
      LEFT JOIN places p ON p.geoname_id = u.place_id
      WHERE u.id = ${viewerId}
    ),
    hits AS (
      SELECT bi.user_id AS owner_id, w.id AS want_id, MIN(c.name) AS card_name
      FROM want_items w
      JOIN cards c ON c.oracle_id = w.oracle_id
      JOIN collection_items bi ON bi.scryfall_id = c.scryfall_id
      WHERE w.user_id = ${viewerId}
        AND c.game = ${CARD_GAME}
        AND bi.for_trade = true
        AND bi.user_id <> ${viewerId}
        ${copyScope()}
      GROUP BY bi.user_id, w.id
    ),
    grouped AS (
      SELECT owner_id,
             COUNT(*)::int AS match_count,
             (ARRAY_AGG(card_name ORDER BY card_name))[1:${sql.raw(String(NAMES_PER_OWNER))}] AS card_names
      FROM hits
      GROUP BY owner_id
    )
    SELECT u.username,
           p.label AS city,
           CASE
             WHEN p.location IS NULL OR viewer.location IS NULL THEN NULL
             ELSE ST_Distance(p.location, viewer.location)
           END AS "distanceMeters",
           g.match_count AS "matchCount",
           g.card_names AS "cardNames"
    FROM grouped g
    JOIN users u ON u.id = g.owner_id
    LEFT JOIN places p ON p.geoname_id = u.place_id
    CROSS JOIN viewer
    WHERE u.trade_binder_visibility = 'public'
      AND u.onboarded_at IS NOT NULL
    ORDER BY "distanceMeters" ASC NULLS LAST, g.match_count DESC, u.username ASC
    LIMIT ${limit}
  `)) as unknown as MatchOwnerRow[];

  return rows.map((row) => ({
    username: row.username,
    city: row.city,
    distanceMeters: row.distanceMeters === null ? null : Math.round(Number(row.distanceMeters)),
    matchCount: Number(row.matchCount),
    cardNames: row.cardNames ?? [],
  }));
}
