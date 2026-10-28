import { requireUser } from '../middleware/auth';
import {
  checkUsernameAvailability,
  completeOnboarding,
  findUsersWithinRadius,
  getProfile,
  listFollowers,
  listFollowing,
  updateProfile,
} from '../modules/users/service';
import { createWantList, rotateWantShareToken } from '../modules/wants/service';
import { AUSTIN_ID, check, NYC_ID, resolves, type SmokeWorld } from './harness';

export async function checkUsers(world: SmokeWorld): Promise<void> {
  const { db, owner, stamp, viewer } = world;

  check('new user is not onboarded', owner.onboardedAt === null);

  check(
    'a capital letter is folded, not refused',
    (await checkUsernameAvailability(db, `Smoke_Free_${stamp}`, owner.id)).username ===
      `smoke_free_${stamp}`,
  );
  check(
    'a reserved username is refused',
    !(await checkUsernameAvailability(db, 'admin', owner.id)).available,
  );
  check(
    'a username with a space is refused',
    !(await checkUsernameAvailability(db, 'smoke free', owner.id)).available,
  );
  check(
    'a free username is offered',
    (await checkUsernameAvailability(db, `smoke_free_${stamp}`, owner.id)).available,
  );
  check(
    "someone else's username is refused",
    !(await checkUsernameAvailability(db, viewer.username, owner.id)).available,
  );

  // Rename before onboarding is refused so the two paths cannot be mixed up.
  check(
    'profile rename is blocked before onboarding',
    !(await resolves(() => updateProfile(db, owner.id, { username: `smoke_early_${stamp}` }))),
  );

  const onboarded = await completeOnboarding(db, owner.id, {
    username: `smoke_chosen_${stamp}`,
    placeId: AUSTIN_ID,
  });
  check('onboarding set the chosen username', onboarded.username === `smoke_chosen_${stamp}`);
  check('onboarding saved the city', onboarded.placeId === AUSTIN_ID, String(onboarded.placeId));
  check('onboarding stamped the time', onboarded.onboardedAt !== null);
  check(
    'onboarding cannot run twice',
    !(await resolves(() =>
      completeOnboarding(db, owner.id, {
        username: `smoke_again_${stamp}`,
      }),
    )),
  );

  const viewerOnboarded = await completeOnboarding(db, viewer.id, {
    username: `smoke_viewer2_${stamp}`,
  });
  check('skipping the city leaves it empty', viewerOnboarded.placeId === null);
  check(
    'a taken username is refused',
    !(await resolves(() => updateProfile(db, viewer.id, { username: onboarded.username }))),
  );
  check(
    'a reserved username is refused on rename',
    !(await resolves(() => updateProfile(db, viewer.id, { username: 'binders' }))),
  );
  check(
    'an unknown city is refused',
    !(await resolves(() =>
      updateProfile(db, viewer.id, {
        username: viewerOnboarded.username,
        placeId: 2_000_000_099,
      }),
    )),
  );
  const renamedUser = await updateProfile(db, viewer.id, {
    username: `smoke_moved_${stamp}`,
    placeId: NYC_ID,
  });
  check('profile rename applied after onboarding', renamedUser.username === `smoke_moved_${stamp}`);
  check('profile saved the city', renamedUser.placeId === NYC_ID, String(renamedUser.placeId));

  check(
    'a private profile is hidden from someone else',
    !(await resolves(() => getProfile(db, onboarded.username, viewer.id))),
  );
  const ownProfile = await getProfile(db, onboarded.username, owner.id);
  check(
    'the owner can open a private profile',
    ownProfile.visibility === 'private' && ownProfile.wantLists === undefined,
  );
  check(
    'a private follower list is hidden',
    !(await resolves(() => listFollowers(db, onboarded.username, viewer.id))),
  );
  check(
    'a private following list is hidden',
    !(await resolves(() => listFollowing(db, onboarded.username, viewer.id))),
  );
  check(
    'the owner can open their follower list',
    (await listFollowers(db, onboarded.username, owner.id)).length === 0,
  );

  const hiddenList = await createWantList(db, owner.id, {
    name: `Smoke hidden ${stamp}`,
    visibility: 'private',
  });
  check(
    'someone else cannot rotate a want list link',
    !(await resolves(() => rotateWantShareToken(db, viewer.id, hiddenList.id))),
  );
  const rotated = await rotateWantShareToken(db, owner.id, hiddenList.id);
  check(
    'the owner can rotate a want list link',
    Boolean(rotated) && rotated !== hiddenList.shareToken,
  );

  const hiddenNearAustin = await findUsersWithinRadius(
    db,
    viewer.id,
    { latitude: 30.45, longitude: -97.7431 },
    50_000,
  );
  check(
    'a private profile stays out of nearby',
    hiddenNearAustin.every((person) => person.username !== onboarded.username),
  );
  await updateProfile(db, owner.id, { profileVisibility: 'public' });

  // About 20 km north of Austin; the farther point is hundreds of km away.
  const nearAustin = await findUsersWithinRadius(
    db,
    viewer.id,
    { latitude: 30.45, longitude: -97.7431 },
    50_000,
  );
  check(
    'ST_DWithin finds the city inside the radius',
    nearAustin.some((person) => person.username === onboarded.username),
    nearAustin.map((person) => person.username).join(','),
  );
  check(
    'a nearby result is a distance, not a pin',
    nearAustin.every(
      (person) =>
        person.distanceMeters >= 0 && person.distanceMeters <= 50_000 && !('latitude' in person),
    ),
  );
  check(
    'the searcher is left out of their own radius',
    nearAustin.every((person) => person.username !== renamedUser.username),
  );
  const farFromAustin = await findUsersWithinRadius(
    db,
    viewer.id,
    { latitude: 35.27, longitude: -97.7431 },
    50_000,
  );
  check(
    'ST_DWithin misses the city outside the radius',
    farFromAustin.every((person) => person.username !== onboarded.username),
  );
  const wideFromAustin = await findUsersWithinRadius(
    db,
    viewer.id,
    { latitude: 35.27, longitude: -97.7431 },
    800_000,
  );
  check(
    'a wider radius reaches the same city',
    wideFromAustin.some((person) => person.username === onboarded.username),
  );

  const clearedCity = await updateProfile(db, viewer.id, {
    username: renamedUser.username,
    placeId: null,
  });
  check('profile can clear the city', clearedCity.placeId === null);
}

/** Two first requests for one Auth0 account must land on the same row. */
export async function checkSignInRace(world: SmokeWorld): Promise<void> {
  const sub = `smoke|race${world.stamp}`;
  const contexts = [signInContext(world.db, sub), signInContext(world.db, sub)];
  await Promise.all(contexts.map((context) => requireUser(context as never, async () => {})));
  const ids = contexts.map((context) => (context.get('user') as { id: string } | undefined)?.id);
  check('two first sign-ins become one user', ids[0] === ids[1] && Boolean(ids[0]));
}

function signInContext(db: SmokeWorld['db'], sub: string) {
  const values = new Map<string, unknown>([
    ['auth', { sub }],
    ['db', db],
  ]);
  return {
    get(key: string) {
      return values.get(key);
    },
    set(key: string, value: unknown) {
      values.set(key, value);
    },
  };
}
