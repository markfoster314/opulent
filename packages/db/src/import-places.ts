import { unzipSync } from 'fflate';
import postgres from 'postgres';
import { postgresSsl } from './connection-string';
import { loadEnv } from './load-env';

loadEnv();

/** Mirrors the GeoNames cities5000 dump (CC BY 4.0) so signup never calls GeoNames and search runs locally; source: download.geonames.org/export/dump/ */

const CITIES_URL = 'https://download.geonames.org/export/dump/cities5000.zip';
const ADMIN1_URL = 'https://download.geonames.org/export/dump/admin1CodesASCII.txt';
const COUNTRY_URL = 'https://download.geonames.org/export/dump/countryInfo.txt';

const BATCH_SIZE = 500;

const PLACE_COLUMNS = [
  'geoname_id',
  'name',
  'ascii_name',
  'country_code',
  'country_name',
  'admin1_code',
  'admin1_name',
  'label',
  'population',
  'latitude',
  'longitude',
] as const;

interface PlaceInsert {
  geoname_id: number;
  name: string;
  ascii_name: string;
  country_code: string;
  country_name: string;
  admin1_code: string;
  admin1_name: string;
  label: string;
  population: number;
  latitude: number;
  longitude: number;
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'opulent-tutor (local city import)' },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function rowsOf(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, ''))
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('\t'));
}

function labelFor(name: string, admin1: string, country: string): string {
  const parts = [name];
  if (admin1 && admin1.toLowerCase() !== name.toLowerCase()) parts.push(admin1);
  if (country && country.toLowerCase() !== name.toLowerCase()) parts.push(country);
  return parts.join(', ');
}

function citiesFrom(text: string, countries: Map<string, string>, admin1: Map<string, string>) {
  const places: PlaceInsert[] = [];

  for (const column of rowsOf(text)) {
    const geonameId = Number(column[0]);
    const latitude = Number(column[4]);
    const longitude = Number(column[5]);
    const name = column[1]?.trim() ?? '';
    if (!Number.isInteger(geonameId) || name.length === 0) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const countryCode = (column[8] ?? '').trim();
    const admin1Code = (column[10] ?? '').trim();
    const countryName = countries.get(countryCode) ?? countryCode;
    const admin1Name = admin1.get(`${countryCode}.${admin1Code}`) ?? '';
    const population = Number(column[14]);

    places.push({
      geoname_id: geonameId,
      name,
      ascii_name: (column[2] ?? name).trim() || name,
      country_code: countryCode,
      country_name: countryName,
      admin1_code: admin1Code,
      admin1_name: admin1Name,
      label: labelFor(name, admin1Name, countryName),
      population: Number.isFinite(population) ? Math.trunc(population) : 0,
      latitude,
      longitude,
    });
  }

  return places;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const sql = postgres(connectionString, {
    max: 1,
    onnotice: () => {},
    ...postgresSsl(connectionString),
  });

  try {
    const table = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'places'
      ) AS exists
    `;
    if (!table[0]?.exists) {
      throw new Error('The places table is missing. Run pnpm db:migrate, then pnpm db:bootstrap.');
    }

    console.log('downloading GeoNames cities5000, countries, and state names');
    const [citiesZip, admin1Bytes, countryBytes] = await Promise.all([
      download(CITIES_URL),
      download(ADMIN1_URL),
      download(COUNTRY_URL),
    ]);

    const unzipped = unzipSync(citiesZip);
    const cityFile = Object.values(unzipped)[0];
    if (!cityFile) throw new Error('cities5000.zip did not contain a city file');

    const countries = new Map<string, string>();
    for (const column of rowsOf(textOf(countryBytes))) {
      const code = column[0]?.trim();
      const name = column[4]?.trim();
      if (code && name) countries.set(code, name);
    }

    const admin1 = new Map<string, string>();
    for (const column of rowsOf(textOf(admin1Bytes))) {
      const code = column[0]?.trim();
      const name = column[1]?.trim();
      if (code && name) admin1.set(code, name);
    }

    const places = citiesFrom(textOf(cityFile), countries, admin1);
    console.log(`read ${places.length} cities`);

    let written = 0;
    await sql.begin(async (tx) => {
      for (let start = 0; start < places.length; start += BATCH_SIZE) {
        const batch = places.slice(start, start + BATCH_SIZE);
        await tx`
          INSERT INTO places ${tx(batch, ...PLACE_COLUMNS)}
          ON CONFLICT (geoname_id) DO UPDATE SET
            name = EXCLUDED.name,
            ascii_name = EXCLUDED.ascii_name,
            country_code = EXCLUDED.country_code,
            country_name = EXCLUDED.country_name,
            admin1_code = EXCLUDED.admin1_code,
            admin1_name = EXCLUDED.admin1_name,
            label = EXCLUDED.label,
            population = EXCLUDED.population,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude
        `;
        written += batch.length;
        if (written % 5000 === 0 || written === places.length) {
          console.log(`written ${written}`);
        }
      }
    });

    await copyTypedCities(sql);
    console.log(`done: ${written} cities in places`);
  } finally {
    await sql.end();
  }
}

/** One-off: points the legacy free-text users.city at the largest matching place, then drops that column. */
async function copyTypedCities(sql: postgres.Sql) {
  const column = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'city'
    ) AS exists
  `;
  if (!column[0]?.exists) return;

  const matched = await sql<{ matched: number }[]>`
    WITH updated AS (
      UPDATE users AS u
      SET place_id = picked.geoname_id
      FROM (
        SELECT DISTINCT ON (u2.id) u2.id AS user_id, p.geoname_id
        FROM users u2
        JOIN places p
          ON lower(p.name) = lower(btrim(u2.city))
          OR lower(p.ascii_name) = lower(btrim(u2.city))
        WHERE u2.place_id IS NULL
          AND u2.city IS NOT NULL
          AND btrim(u2.city) <> ''
        ORDER BY u2.id, p.population DESC
      ) AS picked
      WHERE u.id = picked.user_id
      RETURNING u.id
    )
    SELECT count(*)::int AS matched FROM updated
  `;

  await sql`ALTER TABLE users DROP COLUMN city`;
  console.log(`matched ${matched[0]?.matched ?? 0} saved city names, then removed the text column`);
}

main().catch((error: unknown) => {
  console.error('city import failed', error);
  process.exit(1);
});
