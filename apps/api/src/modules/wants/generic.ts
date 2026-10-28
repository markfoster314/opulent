import type { Database } from '@opulent/db';
import { cards, genericWants } from '@opulent/db';
import type {
  CardSet,
  CreateGenericWantInput,
  GenericMatchOwner,
  GenericWant,
} from '@opulent/shared';
import { CARD_GAME, genericWantMatchKey } from '@opulent/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';

function isDuplicateGenericWant(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'generic_wants_user_match_key';
  });
}

async function namesForSets(
  db: Database,
  codes: readonly string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(codes)];
  const names = new Map<string, string | null>();
  if (unique.length === 0) return names;

  const rows = (await db.execute(sql`
    SELECT
      ${cards.setCode} AS "setCode",
      max(${cards.setName}) AS "setName"
    FROM ${cards}
    WHERE ${cards.game} = ${CARD_GAME}
      AND ${cards.setCode} IN (${sql.join(
        unique.map((code) => sql`${code}`),
        sql`, `,
      )})
    GROUP BY ${cards.setCode}
  `)) as unknown as { setCode: string; setName: string | null }[];

  for (const row of rows) names.set(row.setCode, row.setName);
  return names;
}

function toGenericWant(
  row: {
    id: string;
    userId: string;
    languages: string[];
    finishes: string[];
    conditions: string[];
    sets: string[];
    signed: boolean;
    altered: boolean;
    misprint: boolean;
    miscut: boolean;
    artistProof: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  setNames: Map<string, string | null>,
): GenericWant {
  return {
    id: row.id,
    userId: row.userId,
    languages: row.languages as GenericWant['languages'],
    finishes: row.finishes as GenericWant['finishes'],
    conditions: row.conditions as GenericWant['conditions'],
    sets: row.sets.map((setCode): CardSet => ({ setCode, setName: setNames.get(setCode) ?? null })),
    signed: row.signed,
    altered: row.altered,
    misprint: row.misprint,
    miscut: row.miscut,
    artistProof: row.artistProof,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listGenericWants(db: Database, userId: string): Promise<GenericWant[]> {
  const rows = await db
    .select()
    .from(genericWants)
    .where(eq(genericWants.userId, userId))
    .orderBy(desc(genericWants.createdAt));

  const setNames = await namesForSets(
    db,
    rows.flatMap((row) => row.sets),
  );
  return rows.map((row) => toGenericWant(row, setNames));
}

export async function createGenericWant(
  db: Database,
  userId: string,
  input: CreateGenericWantInput,
): Promise<GenericWant> {
  const setNames = await namesForSets(db, input.sets);
  const missing = input.sets.filter((code) => !setNames.has(code));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Unknown set: ${missing.map((code) => code.toUpperCase()).join(', ')}`,
    );
  }

  try {
    const inserted = await db
      .insert(genericWants)
      .values({
        userId,
        languages: [...input.languages],
        finishes: [...input.finishes],
        conditions: [...input.conditions],
        sets: [...input.sets],
        signed: input.signed,
        altered: input.altered,
        misprint: input.misprint,
        miscut: input.miscut,
        artistProof: input.artistProof,
        matchKey: genericWantMatchKey(input),
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new ApiError('internal_error', 'Could not save that interest');
    return toGenericWant(row, setNames);
  } catch (error) {
    if (isDuplicateGenericWant(error)) {
      throw ApiError.conflict('You already saved that mix of choices.');
    }
    throw error;
  }
}

export async function removeGenericWant(
  db: Database,
  userId: string,
  wantId: string,
): Promise<void> {
  const removed = await db
    .delete(genericWants)
    .where(and(eq(genericWants.id, wantId), eq(genericWants.userId, userId)))
    .returning({ id: genericWants.id });
  if (!removed[0]) throw ApiError.notFound('Generic want not found');
}

/** Generic matches; each fitting stack counts once, and results are capped per owner. */
export async function findGenericMatchOwners(
  db: Database,
  viewerId: string,
  limit: number,
): Promise<GenericMatchOwner[]> {
  const rows = (await db.execute(sql`
    WITH viewer AS (
      SELECT p.location
      FROM users u
      LEFT JOIN places p ON p.geoname_id = u.place_id
      WHERE u.id = ${viewerId}
    ),
    hits AS (
      SELECT
        bi.user_id AS owner_id,
        bi.id AS item_id,
        min(c.name) AS card_name,
        min(c.set_code) AS set_code,
        (array_agg(c.image_uris))[1] AS image_uris,
        min(bi.finish::text) AS finish,
        min(bi.condition::text) AS condition,
        min(c.lang) AS lang,
        sum(bi.quantity)::int AS quantity
      FROM generic_wants gw
      JOIN collection_items bi ON bi.for_trade = true AND bi.user_id <> ${viewerId}
      JOIN cards c ON c.scryfall_id = bi.scryfall_id
      WHERE gw.user_id = ${viewerId}
        AND c.game = ${CARD_GAME}
        AND (cardinality(gw.languages) = 0 OR c.lang = ANY(gw.languages))
        AND (cardinality(gw.finishes) = 0 OR bi.finish::text = ANY(gw.finishes))
        AND (cardinality(gw.conditions) = 0 OR bi.condition::text = ANY(gw.conditions))
        AND (cardinality(gw.sets) = 0 OR lower(c.set_code) = ANY(gw.sets))
        AND (NOT gw.signed OR bi.signed)
        AND (NOT gw.altered OR bi.altered)
        AND (NOT gw.misprint OR bi.misprint)
        AND (NOT gw.miscut OR bi.miscut)
        AND (NOT gw.artist_proof OR bi.artist_proof)
      GROUP BY bi.user_id, bi.id
    ),
    grouped AS (
      SELECT
        owner_id,
        count(*)::int AS match_count,
        jsonb_agg(
          jsonb_build_object(
            'name', card_name,
            'setCode', set_code,
            'imageUris', image_uris,
            'finish', finish,
            'condition', condition,
            'language', lang,
            'quantity', quantity
          )
          ORDER BY card_name
        ) AS cards
      FROM hits
      GROUP BY owner_id
    )
    SELECT
      u.username,
      p.label AS city,
      CASE
        WHEN p.location IS NULL OR viewer.location IS NULL THEN NULL
        ELSE ST_Distance(p.location, viewer.location)
      END AS "distanceMeters",
      g.match_count AS "matchCount",
      g.cards
    FROM grouped g
    JOIN users u ON u.id = g.owner_id
    LEFT JOIN places p ON p.geoname_id = u.place_id
    CROSS JOIN viewer
    WHERE u.trade_binder_visibility = 'public'
      AND u.onboarded_at IS NOT NULL
    ORDER BY "distanceMeters" ASC NULLS LAST, g.match_count DESC, u.username ASC
    LIMIT ${limit}
  `)) as unknown as {
    username: string;
    city: string | null;
    distanceMeters: number | string | null;
    matchCount: number | string;
    cards: GenericMatchOwner['cards'];
  }[];

  return rows.map((row) => ({
    username: row.username,
    city: row.city,
    distanceMeters: row.distanceMeters === null ? null : Math.round(Number(row.distanceMeters)),
    matchCount: Number(row.matchCount),
    cards: (row.cards ?? []).slice(0, 4),
  }));
}
