import type { Database } from '@opulent/db';
import { cardGroups, cards, collectionItems, groupMemberships } from '@opulent/db';
import type { CollectionImportInput, CollectionImportResult, ImportRow } from '@opulent/shared';
import { CARD_GAME, PLAIN_CSV_COLUMNS } from '@opulent/shared';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import {
  columnIndexes,
  detectFormat,
  parseCondition,
  parseCsv,
  parseFinish,
  parseForTrade,
  parseLanguage,
  parseQuantity,
  readRow,
  toCsvLine,
} from './csv';

/** Rows sent back in the preview. The counts cover every row. */
const PREVIEW_ROWS = 200;
const BATCH = 200;

interface PrintingHit {
  scryfallId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  lang: string;
}

/** Match by Scryfall id, then set/number/language (cards_printing_key), then name/set; dry runs write nothing. */
export async function importCollection(
  db: Database,
  userId: string,
  input: CollectionImportInput,
): Promise<CollectionImportResult> {
  const table = parseCsv(input.csv);
  const header = table[0];
  if (!header || table.length < 2) {
    throw ApiError.badRequest('The file needs a header row and at least one card row.');
  }
  const format = detectFormat(header);
  const at = columnIndexes(header, format);
  if (at.name === -1 && at.scryfallId === -1) {
    throw ApiError.badRequest('Could not find a card name column in this file.');
  }

  const groupIds = [...new Set(input.groupIds ?? [])];
  if (groupIds.length > 0) {
    const owned = await db
      .select({ id: cardGroups.id })
      .from(cardGroups)
      .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
    if (owned.length !== groupIds.length) {
      throw ApiError.badRequest('One of those groups is not yours.');
    }
  }

  const raw = table.slice(1).map((cells, index) => ({ line: index + 2, row: readRow(cells, at) }));

  // One trip for every key the file mentions, then match in memory.
  const byId = await printingsById(
    db,
    raw.map((entry) => entry.row.scryfallId).filter((id) => isUuid(id)),
  );
  const byKey = await printingsByKey(db, raw);
  const byNameSet = await printingsByNameSet(db, raw);

  const rows: ImportRow[] = [];
  const writes = new Map<string, ImportRow>();
  let matched = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const { line, row } of raw) {
    const quantity = parseQuantity(row.quantity);
    const finish = parseFinish(row.finish);
    const condition = parseCondition(row.condition);
    const language = parseLanguage(row.language);
    const forTrade = parseForTrade(row.forTrade, input.forTradeDefault);
    const setCode = row.set.trim().toLowerCase();
    const number = row.number.trim();

    const base = {
      line,
      name: row.name,
      setCode,
      collectorNumber: number || null,
      quantity: quantity ?? 0,
      condition,
      finish,
      language,
      forTrade,
    };

    if (quantity === null || quantity === 0) {
      skipped += 1;
      rows.push({
        ...base,
        status: 'skipped',
        scryfallId: null,
        reason: quantity === null ? 'Quantity is not a whole number.' : 'Quantity is zero.',
      });
      continue;
    }

    const hit =
      (isUuid(row.scryfallId) ? byId.get(row.scryfallId) : undefined) ??
      (setCode && number ? byKey.get(printingKey(setCode, number, language)) : undefined) ??
      (setCode && number && language !== 'en'
        ? byKey.get(printingKey(setCode, number, 'en'))
        : undefined) ??
      (row.name && setCode ? byNameSet.get(nameSetKey(row.name, setCode)) : undefined);

    if (!hit) {
      unmatched += 1;
      rows.push({ ...base, status: 'unmatched', scryfallId: null, reason: whyNoMatch(row) });
      continue;
    }

    matched += 1;
    const line_: ImportRow = {
      ...base,
      name: hit.name,
      setCode: hit.setCode,
      collectorNumber: hit.collectorNumber,
      status: 'matched',
      scryfallId: hit.scryfallId,
      reason: null,
    };
    rows.push(line_);

    // Same stack twice in one file becomes one write with the summed count.
    const stackKey = [hit.scryfallId, finish, condition, language, forTrade].join('|');
    const existing = writes.get(stackKey);
    if (existing) existing.quantity += quantity;
    else writes.set(stackKey, { ...line_ });
  }

  let added = 0;
  if (!input.dryRun) added = await writeStacks(db, userId, [...writes.values()], groupIds);

  return {
    dryRun: input.dryRun,
    format,
    total: raw.length,
    matched,
    unmatched,
    skipped,
    added,
    rows: rows.slice(0, PREVIEW_ROWS),
  };
}

async function writeStacks(
  db: Database,
  userId: string,
  lines: ImportRow[],
  groupIds: string[],
): Promise<number> {
  let added = 0;
  for (let start = 0; start < lines.length; start += BATCH) {
    const chunk = lines.slice(start, start + BATCH);
    const inserted = await db
      .insert(collectionItems)
      .values(
        chunk.map((line) => ({
          userId,
          scryfallId: line.scryfallId as string,
          quantity: line.quantity,
          finish: line.finish,
          condition: line.condition,
          language: line.language,
          signed: false,
          altered: false,
          misprint: false,
          miscut: false,
          artistProof: false,
          forTrade: line.forTrade,
          priceKind: 'market' as const,
          pricePercent: 100,
          priceAmount: '',
        })),
      )
      .onConflictDoUpdate({
        target: [
          collectionItems.userId,
          collectionItems.scryfallId,
          collectionItems.finish,
          collectionItems.condition,
          collectionItems.language,
          collectionItems.signed,
          collectionItems.altered,
          collectionItems.misprint,
          collectionItems.miscut,
          collectionItems.artistProof,
        ],
        set: {
          quantity: sql`${collectionItems.quantity} + excluded.quantity`,
          forTrade: sql`${collectionItems.forTrade} OR excluded.for_trade`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: collectionItems.id });

    if (groupIds.length > 0 && inserted.length > 0) {
      await db
        .insert(groupMemberships)
        .values(
          inserted.flatMap((row) =>
            groupIds.map((groupId) => ({ itemId: row.id, groupId, userId })),
          ),
        )
        .onConflictDoNothing();
    }
    added += chunk.reduce((sum, line) => sum + line.quantity, 0);
  }
  return added;
}

/** Same paper-only rule as adding one card by hand. */
function paperOnly() {
  return and(
    eq(cards.game, CARD_GAME),
    sql`jsonb_exists(${cards.raw}->'games', 'paper')`,
    sql`${cards.layout} IS DISTINCT FROM 'art_series'`,
  );
}

const printingColumns = {
  scryfallId: cards.scryfallId,
  name: cards.name,
  setCode: cards.setCode,
  collectorNumber: cards.collectorNumber,
  lang: cards.lang,
};

async function printingsById(db: Database, ids: string[]): Promise<Map<string, PrintingHit>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select(printingColumns)
    .from(cards)
    .where(and(inArray(cards.scryfallId, unique), paperOnly()));
  return new Map(rows.map((row) => [row.scryfallId, row]));
}

async function printingsByKey(
  db: Database,
  raw: { row: { set: string; number: string; language: string } }[],
): Promise<Map<string, PrintingHit>> {
  const sets = new Set<string>();
  const numbers = new Set<string>();
  for (const { row } of raw) {
    const setCode = row.set.trim().toLowerCase();
    const number = row.number.trim();
    if (setCode && number) {
      sets.add(setCode);
      numbers.add(number);
    }
  }
  if (sets.size === 0) return new Map();
  const rows = await db
    .select(printingColumns)
    .from(cards)
    .where(
      and(
        inArray(sql`lower(${cards.setCode})`, [...sets]),
        inArray(cards.collectorNumber, [...numbers]),
        paperOnly(),
      ),
    );
  return new Map(
    rows.map((row) => [printingKey(row.setCode.toLowerCase(), row.collectorNumber, row.lang), row]),
  );
}

/** Name + set match; lowest collector number wins, English first. */
async function printingsByNameSet(
  db: Database,
  raw: { row: { name: string; set: string } }[],
): Promise<Map<string, PrintingHit>> {
  const names = new Set<string>();
  const sets = new Set<string>();
  for (const { row } of raw) {
    const setCode = row.set.trim().toLowerCase();
    if (row.name.trim() && setCode) {
      names.add(row.name.trim().toLowerCase());
      sets.add(setCode);
    }
  }
  if (names.size === 0) return new Map();
  const rows = await db
    .select(printingColumns)
    .from(cards)
    .where(
      and(
        or(
          inArray(sql`lower(${cards.name})`, [...names]),
          // "Fire // Ice" files often carry only the front face.
          inArray(sql`lower(split_part(${cards.name}, ' // ', 1))`, [...names]),
        ),
        inArray(sql`lower(${cards.setCode})`, [...sets]),
        paperOnly(),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${cards.lang} = 'en' THEN 0 ELSE 1 END`,
      asc(sql`length(${cards.collectorNumber})`),
      asc(cards.collectorNumber),
    );
  const map = new Map<string, PrintingHit>();
  for (const row of rows) {
    const setCode = row.setCode.toLowerCase();
    for (const name of [row.name, row.name.split(' // ')[0] ?? row.name]) {
      const key = nameSetKey(name, setCode);
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

function printingKey(setCode: string, number: string, lang: string): string {
  return `${setCode}|${number}|${lang}`;
}

function nameSetKey(name: string, setCode: string): string {
  return `${name.trim().toLowerCase()}|${setCode}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function whyNoMatch(row: { name: string; set: string; number: string }): string {
  if (!row.set.trim()) return 'No set code on this row.';
  if (!row.number.trim() && !row.name.trim()) return 'No collector number or card name.';
  return 'No paper printing with this set, number, or name in our card list.';
}

/** Plain export: one line per stack, with its own finish and condition. */
export async function exportCollectionCsv(
  db: Database,
  userId: string,
  groupId?: string,
): Promise<string> {
  const rows = await db
    .select({
      name: cards.name,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      quantity: collectionItems.quantity,
      condition: collectionItems.condition,
      finish: collectionItems.finish,
      language: collectionItems.language,
      forTrade: collectionItems.forTrade,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .$dynamic()
    .where(
      and(
        eq(collectionItems.userId, userId),
        eq(cards.game, CARD_GAME),
        groupId
          ? sql`EXISTS (
              SELECT 1 FROM ${groupMemberships}
              WHERE ${groupMemberships.itemId} = ${collectionItems.id}
                AND ${groupMemberships.groupId} = ${groupId}::uuid
            )`
          : undefined,
      ),
    )
    .orderBy(asc(cards.name), asc(cards.setCode), asc(cards.collectorNumber));

  const lines = [toCsvLine([...PLAIN_CSV_COLUMNS])];
  for (const row of rows) {
    lines.push(
      toCsvLine([
        row.name,
        row.setCode,
        row.collectorNumber,
        row.quantity,
        row.condition,
        row.finish,
        row.language,
        row.forTrade ? 'true' : 'false',
      ]),
    );
  }
  return `${lines.join('\n')}\n`;
}
