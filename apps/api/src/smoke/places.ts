import { searchPlaces } from '../modules/places/service';
import { AUSTIN_ID, check, NYC_ID, type SmokeWorld } from './harness';

export async function checkPlaces(world: SmokeWorld): Promise<void> {
  const { db } = world;

  const austinTexas = await searchPlaces(db, 'Austin, Texas');
  check(
    'city and state keep that state',
    austinTexas.some((place) => place.geonameId === AUSTIN_ID) &&
      austinTexas.every((place) => place.label.includes(', Texas,')),
    austinTexas.map((place) => place.label).join(' | '),
  );
  const austinCode = await searchPlaces(db, 'Austin, TX');
  check(
    'a state code finds the same city',
    austinCode.some((place) => place.geonameId === AUSTIN_ID),
  );
  const austinFull = await searchPlaces(db, 'Austin, Texas, United States');
  check(
    'city, state, and country find that place',
    austinFull.some((place) => place.geonameId === AUSTIN_ID) &&
      austinFull.every((place) => place.label.includes(', Texas, United States')),
    austinFull.map((place) => place.label).join(' | '),
  );
  const austinElsewhere = await searchPlaces(db, 'Austin, New York');
  check(
    'a different state leaves Austin, Texas out',
    austinElsewhere.every((place) => place.geonameId !== AUSTIN_ID),
  );
  const newYorkFull = await searchPlaces(db, 'New York, New York, United States');
  check(
    'city, state, and country find New York',
    newYorkFull.some((place) => place.geonameId === NYC_ID),
    newYorkFull.map((place) => place.label).join(' | '),
  );
}
