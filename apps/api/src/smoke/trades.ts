import { users } from '@opulent/db';
import { eq } from 'drizzle-orm';
import { assertCanViewTradeBinder } from '../modules/collection/service';
import { openTrade } from '../modules/trades/service';
import { updateProfile } from '../modules/users/service';
import { check, passes, PRINTING_A, resolves, type SmokeWorld } from './harness';

export async function checkTrades(world: SmokeWorld): Promise<void> {
  const { db, owner, stamp, viewer } = world;
  const username = `smoke_chosen_${stamp}`;

  const ownerRow = (await db.select().from(users).where(eq(users.id, owner.id)).limit(1))[0]!;
  check(
    'a trade binder starts private',
    !passes(() => assertCanViewTradeBinder(ownerRow, { userId: viewer.id })),
  );
  await updateProfile(db, owner.id, { tradeBinderVisibility: 'unlisted' });
  check(
    'an unlisted binder refuses a new trade',
    !(await resolves(() =>
      openTrade(db, viewer.id, {
        username,
        items: [{ scryfallId: PRINTING_A, quantity: 1 }],
      }),
    )),
  );
  await updateProfile(db, owner.id, { tradeBinderVisibility: 'public' });
  const openOwner = (await db.select().from(users).where(eq(users.id, owner.id)).limit(1))[0]!;
  check(
    'a public trade binder opens to a stranger',
    passes(() => assertCanViewTradeBinder(openOwner, { userId: viewer.id })),
  );
}
