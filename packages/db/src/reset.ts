import postgres from 'postgres';
import { loadEnv } from './load-env';
import { runSeed } from './seed';

/** Empties every app table then re-seeds; cards, places, and the PostGIS spatial_ref_sys table survive because city search reads them. */

const KEEP = new Set(['cards', 'places', 'spatial_ref_sys']);

async function emptyAppTables(): Promise<void> {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to the repo .env file.');
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const targets = rows.map((row) => row.table_name).filter((name) => !KEEP.has(name));
    for (const name of targets) {
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
        throw new Error(`Unexpected table name: ${name}`);
      }
    }

    const before = await counts(sql);
    if (targets.length > 0) {
      const list = targets.map((name) => `"${name}"`).join(', ');
      await sql.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
    const after = await counts(sql);
    if (before.cards !== after.cards || before.places !== after.places) {
      throw new Error('The card list or the city list changed. Stop and check the database.');
    }

    console.log(
      targets.length > 0 ? `Emptied ${targets.join(', ')}.` : 'App tables were already empty.',
    );
    console.log(
      `Cards still ${after.cards.toLocaleString()}. Cities still ${after.places.toLocaleString()}.`,
    );
  } finally {
    await sql.end();
  }
}

async function counts(sql: postgres.Sql): Promise<{ cards: number; places: number }> {
  const [row] = await sql<{ cards: number; places: number }[]>`
    SELECT
      (SELECT count(*)::int FROM cards) AS cards,
      (SELECT count(*)::int FROM places) AS places
  `;
  if (!row) throw new Error('Could not count cards and cities.');
  return row;
}

async function main() {
  await emptyAppTables();
  await runSeed();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
