import type { Database } from '@opulent/db';
import { cards, wantItems, wantListItems, wantLists } from '@opulent/db';
import type { WantsImportInput, WantsImportResult, WantImportRow } from '@opulent/shared';
import {
  CARD_GAME,
  WANT_CSV_COLUMNS,
  cardConditionSchema,
  cardFinishSchema,
  cardLanguageSchema,
  wantScopeKey,
} from '@opulent/shared';
import { and, eq, sql } from 'drizzle-orm';
import { ApiError, slugify } from '../../lib/http';
import { parseCsv, toCsvLine } from '../collection/csv';

const PREVIEW_ROWS = 200;
const BATCH = 200;

const columnNames: Record<string, string[]> = {
  name: ['name', 'card', 'card name'],
  set: ['set', 'set code', 'edition'],
  finish: ['finish', 'foil'],
  language: ['language', 'lang'],
  condition: ['condition'],
  quantity: ['quantity', 'qty', 'count'],
  priority: ['priority'],
  notes: ['notes', 'note'],
  lists: ['lists', 'list'],
  oracleId: ['oracle_id', 'oracle id'],
};

type ColumnKey = keyof typeof columnNames;

function columnIndexes(header: string[]): Record<ColumnKey, number> {
  const lower = header.map((cell) => cell.trim().toLowerCase());
  const find = (names: string[]) => {
    for (const name of names) {
      const at = lower.indexOf(name);
      if (at !== -1) return at;
    }
    return -1;
  };
  return Object.fromEntries(
    Object.entries(columnNames).map(([key, names]) => [key, find(names)]),
  ) as Record<ColumnKey, number>;
}

function readRow(cells: string[], at: Record<ColumnKey, number>) {
  const pick = (key: ColumnKey) => {
    const index = at[key] ?? -1;
    return index === -1 ? '' : (cells[index] ?? '').trim();
  };
  return {
    name: pick('name'),
    set: pick('set'),
    finish: pick('finish'),
    language: pick('language'),
    condition: pick('condition'),
    quantity: pick('quantity'),
    priority: pick('priority'),
    notes: pick('notes'),
    lists: pick('lists'),
    oracleId: pick('oracleId'),
  };
}

function splitList(value: string): string[] {
  return [
    ...new Set(
      value
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

function optionalEnum<T extends string>(
  value: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  upper = false,
): T | null {
  if (!value.trim()) return null;
  const parsed = schema.safeParse(upper ? value.trim().toUpperCase() : value.trim().toLowerCase());
  return parsed.success && parsed.data ? parsed.data : null;
}

function parsePriority(value: string): 1 | 2 | 3 | null {
  const word = value.trim().toLowerCase();
  if (!word) return 2;
  if (word === 'high' || word === '1') return 1;
  if (word === 'medium' || word === '2') return 2;
  if (word === 'low' || word === '3') return 3;
  return null;
}

function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 1;
  const amount = Number(trimmed);
  if (!Number.isInteger(amount) || amount < 1 || amount > 999) return null;
  return amount;
}

interface MatchedRow {
  line: number;
  oracleId: string;
  name: string;
  setCode: string;
  finishes: string[];
  languages: string[];
  conditions: string[];
  sets: string[];
  quantity: number;
  priority: 1 | 2 | 3;
  notes: string | null;
  lists: string[];
  scopeKey: string;
}

interface WriteRow extends MatchedRow {
  listNames: string[];
}

/** A bare name means any version; filters narrow it, | adds alternatives, and missing lists become private. */
export async function importWants(
  db: Database,
  userId: string,
  input: WantsImportInput,
): Promise<WantsImportResult> {
  const table = parseCsv(input.csv);
  const header = table[0];
  if (!header || table.length < 2) {
    throw ApiError.badRequest('The file needs a header row and at least one card row.');
  }
  const at = columnIndexes(header);
  if (at.name === -1 && at.oracleId === -1) {
    throw ApiError.badRequest('Could not find a card name or oracle id column.');
  }
  const raw = table.slice(1).map((cells, index) => ({
    line: index + 2,
    row: readRow(cells, at),
  }));

  if (input.listId) {
    const owned = await db
      .select({ id: wantLists.id })
      .from(wantLists)
      .where(and(eq(wantLists.id, input.listId), eq(wantLists.userId, userId)))
      .limit(1);
    if (!owned[0]) throw ApiError.notFound('Want list not found');
  }

  const oracleIds = [
    ...new Set(raw.map((entry) => entry.row.oracleId).filter((id) => /^[0-9a-f-]{36}$/i.test(id))),
  ];
  const names = [...new Set(raw.map((entry) => entry.row.name.toLowerCase()).filter(Boolean))];
  const cardRows = (await db.execute(sql`
    SELECT DISTINCT ON (${cards.oracleId})
      ${cards.oracleId} AS "oracleId",
      ${cards.name} AS name
    FROM ${cards}
    WHERE ${cards.game} = ${CARD_GAME}
      AND jsonb_exists(${cards.raw}->'games', 'paper')
      AND ${cards.layout} IS DISTINCT FROM 'art_series'
      AND (
        ${
          oracleIds.length > 0
            ? sql`${cards.oracleId} IN (${sql.join(
                oracleIds.map((id) => sql`${id}::uuid`),
                sql`, `,
              )})`
            : sql`false`
        }
        OR ${
          names.length > 0
            ? sql`lower(${cards.name}) IN (${sql.join(
                names.map((name) => sql`${name}`),
                sql`, `,
              )})`
            : sql`false`
        }
      )
    ORDER BY ${cards.oracleId}, ${cards.releasedAt} ASC NULLS LAST, (${cards.lang} = 'en') DESC
  `)) as unknown as { oracleId: string; name: string }[];

  const byOracle = new Map(cardRows.map((row) => [row.oracleId, row]));
  const byName = new Map<string, { oracleId: string; name: string }>();
  for (const row of cardRows) {
    const full = row.name.toLowerCase();
    const front = row.name.split(' // ')[0]?.toLowerCase() ?? full;
    if (!byName.has(full)) byName.set(full, row);
    if (!byName.has(front)) byName.set(front, row);
  }

  const setPairs = raw.flatMap((entry) => {
    const oracleId = entry.row.oracleId || byName.get(entry.row.name.toLowerCase())?.oracleId;
    if (!oracleId) return [];
    return splitList(entry.row.set.toLowerCase()).map((setCode) => `${oracleId}|${setCode}`);
  });
  const validSets = new Set<string>();
  if (setPairs.length > 0) {
    const setCodes = [...new Set(setPairs.map((pair) => pair.split('|')[1]!))];
    const setRows = (await db.execute(sql`
      SELECT DISTINCT ${cards.oracleId} AS "oracleId", lower(${cards.setCode}) AS "setCode"
      FROM ${cards}
      WHERE ${cards.game} = ${CARD_GAME}
        AND lower(${cards.setCode}) IN (${sql.join(
          setCodes.map((code) => sql`${code}`),
          sql`, `,
        )})
    `)) as unknown as { oracleId: string; setCode: string }[];
    for (const row of setRows) validSets.add(`${row.oracleId}|${row.setCode}`);
  }

  const writes = new Map<string, WriteRow>();
  const rows: WantImportRow[] = [];
  const missingLists = new Set<string>();

  for (const { line, row } of raw) {
    const quantity = parseQuantity(row.quantity);
    const priority = parsePriority(row.priority);
    const finishes = splitList(row.finish)
      .map((value) => optionalEnum(value, cardFinishSchema))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const languages = splitList(row.language)
      .map((value) => optionalEnum(value, cardLanguageSchema))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const conditions = splitList(row.condition)
      .map((value) => optionalEnum(value, cardConditionSchema, true))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const setCodes = splitList(row.set.toLowerCase());
    const lists = splitList(row.lists);
    const hit = row.oracleId ? byOracle.get(row.oracleId) : byName.get(row.name.toLowerCase());

    const base: WantImportRow = {
      line,
      status: 'skipped',
      name: row.name,
      setCode: setCodes[0] ?? '',
      finish: finishes[0] ?? null,
      language: languages[0] ?? null,
      condition: conditions[0] ?? null,
      quantity: quantity ?? 0,
      priority: priority ?? 2,
      notes: row.notes || null,
      lists,
      oracleId: hit?.oracleId ?? null,
      reason: null,
    };

    if (!hit) {
      rows.push({
        ...base,
        status: 'unmatched',
        reason: 'No paper printing with that name or oracle id.',
      });
      continue;
    }
    if (quantity === null) {
      rows.push({
        ...base,
        status: 'skipped',
        reason: 'Quantity must be a whole number from 1 to 999.',
      });
      continue;
    }
    if (priority === null) {
      rows.push({
        ...base,
        status: 'skipped',
        reason: 'Priority must be high, medium, low, 1, 2, or 3.',
      });
      continue;
    }
    const badSet = setCodes.find((code) => !validSets.has(`${hit.oracleId}|${code}`));
    if (badSet) {
      rows.push({
        ...base,
        status: 'skipped',
        reason: 'That card was not printed in that set.',
      });
      continue;
    }

    const scope = {
      wantedLanguages: languages,
      wantedFinishes: finishes,
      wantedConditions: conditions,
      wantedSets: setCodes,
    };
    const scopeKey = wantScopeKey(scope);
    const key = `${hit.oracleId}|${scopeKey}`;
    const existing = writes.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.priority = Math.min(existing.priority, priority) as 1 | 2 | 3;
      existing.lists = [...new Set([...existing.lists, ...lists])];
    } else {
      writes.set(key, {
        line,
        oracleId: hit.oracleId,
        name: hit.name,
        setCode: setCodes[0] ?? '',
        finishes: scope.wantedFinishes,
        languages: scope.wantedLanguages,
        conditions: scope.wantedConditions,
        sets: scope.wantedSets,
        quantity,
        priority,
        notes: row.notes.slice(0, 280) || null,
        lists,
        scopeKey,
        listNames: lists,
      });
    }
    rows.push({ ...base, status: 'matched', oracleId: hit.oracleId });
  }

  const existingLists = await db
    .select({ id: wantLists.id, name: wantLists.name, slug: wantLists.slug })
    .from(wantLists)
    .where(eq(wantLists.userId, userId));
  const listByName = new Map(
    existingLists.map((list) => [list.name.trim().toLowerCase(), list] as const),
  );
  const listBySlug = new Map(existingLists.map((list) => [list.slug, list] as const));
  const requestedNames = [
    ...new Set(
      [...writes.values()]
        .flatMap((write) => write.lists)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  for (const name of requestedNames) {
    if (!listByName.has(name.toLowerCase())) missingLists.add(name);
  }

  const created: { id: string; name: string }[] = [];
  if (!input.dryRun && missingLists.size > 0) {
    for (const name of missingLists) {
      const baseSlug = slugify(name) || 'wants';
      let slug = baseSlug;
      let suffix = 2;
      while (listBySlug.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      const [list] = await db
        .insert(wantLists)
        .values({ userId, name, slug, visibility: 'private' })
        .returning({ id: wantLists.id, name: wantLists.name });
      if (list) {
        created.push(list);
        listByName.set(name.toLowerCase(), { id: list.id, name: list.name, slug });
        listBySlug.set(slug, { id: list.id, name: list.name, slug });
      }
    }
  }

  let added = 0;
  if (!input.dryRun) {
    const all = [...writes.values()];
    for (let start = 0; start < all.length; start += BATCH) {
      const chunk = all.slice(start, start + BATCH);
      const inserted = await db
        .insert(wantItems)
        .values(
          chunk.map((write) => ({
            userId,
            oracleId: write.oracleId,
            quantity: write.quantity,
            priority: write.priority,
            notes: write.notes,
            wantedLanguages: write.languages,
            wantedFinishes: write.finishes,
            wantedConditions: write.conditions,
            wantedSets: write.sets,
            scopeKey: write.scopeKey,
          })),
        )
        .onConflictDoUpdate({
          target: [wantItems.userId, wantItems.oracleId, wantItems.scopeKey],
          set: {
            quantity: sql`${wantItems.quantity} + excluded.quantity`,
            priority: sql`least(${wantItems.priority}, excluded.priority)`,
            notes: sql`coalesce(${wantItems.notes}, excluded.notes)`,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: wantItems.id,
          oracleId: wantItems.oracleId,
          scopeKey: wantItems.scopeKey,
        });

      const idByKey = new Map(
        inserted.map((row) => [`${row.oracleId}|${row.scopeKey}`, row.id] as const),
      );
      const memberships = chunk.flatMap((write) => {
        const wantId = idByKey.get(`${write.oracleId}|${write.scopeKey}`);
        if (!wantId) return [];
        const ids = write.lists
          .map((name) => listByName.get(name.trim().toLowerCase())?.id)
          .filter((id): id is string => Boolean(id));
        if (input.listId) ids.push(input.listId);
        return [...new Set(ids)].map((wantListId) => ({ wantListId, wantItemId: wantId, userId }));
      });
      if (memberships.length > 0) {
        await db.insert(wantListItems).values(memberships).onConflictDoNothing();
      }
    }
    added = all.reduce((sum, write) => sum + write.quantity, 0);
  }

  return {
    dryRun: input.dryRun,
    total: raw.length,
    matched: rows.filter((row) => row.status === 'matched').length,
    unmatched: rows.filter((row) => row.status === 'unmatched').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    added,
    listsCreated: input.dryRun ? [...missingLists] : created.map((list) => list.name),
    rows: rows.slice(0, PREVIEW_ROWS),
  };
}

export async function exportWantsCsv(
  db: Database,
  userId: string,
  listId?: string,
): Promise<string> {
  const rows = (await db.execute(sql`
    SELECT
      w.id,
      w.oracle_id AS "oracleId",
      w.quantity,
      w.priority,
      w.notes,
      w.wanted_languages AS "languages",
      w.wanted_finishes AS "finishes",
      w.wanted_conditions AS "conditions",
      w.wanted_sets AS "sets",
      c.name,
      coalesce(l.names, '') AS lists
    FROM want_items w
    LEFT JOIN LATERAL (
      SELECT ${cards.name} AS name
      FROM ${cards}
      WHERE ${cards.oracleId} = w.oracle_id
        AND ${cards.game} = ${CARD_GAME}
      ORDER BY ${cards.releasedAt} ASC NULLS LAST, (${cards.lang} = 'en') DESC, ${cards.scryfallId}
      LIMIT 1
    ) c ON true
    LEFT JOIN (
      SELECT wli.want_item_id, string_agg(wl.name, '|' ORDER BY wl.name) AS names
      FROM want_list_items wli
      JOIN want_lists wl ON wl.id = wli.want_list_id
      WHERE wli.user_id = ${userId}
      ${listId ? sql`AND wli.want_list_id = ${listId}::uuid` : sql``}
      GROUP BY wli.want_item_id
    ) l ON l.want_item_id = w.id
    WHERE w.user_id = ${userId}
      ${listId ? sql`AND EXISTS (SELECT 1 FROM want_list_items x WHERE x.want_item_id = w.id AND x.want_list_id = ${listId}::uuid)` : sql``}
    ORDER BY w.priority ASC, c.name ASC
  `)) as unknown as {
    name: string | null;
    oracleId: string;
    quantity: number;
    priority: number;
    notes: string | null;
    languages: string[];
    finishes: string[];
    conditions: string[];
    sets: string[];
    lists: string;
  }[];

  const lines = [toCsvLine([...WANT_CSV_COLUMNS])];
  for (const row of rows) {
    lines.push(
      toCsvLine([
        row.name ?? '',
        row.sets.join('|'),
        row.finishes.join('|'),
        row.languages.join('|'),
        row.conditions.join('|'),
        row.quantity,
        row.priority,
        row.notes ?? '',
        row.lists,
        row.oracleId,
      ]),
    );
  }
  return `${lines.join('\n')}\n`;
}
