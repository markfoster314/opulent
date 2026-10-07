import type { Database, UserRow } from '@opulent/db';
import { users } from '@opulent/db';
import type { UpdateProfileInput } from '@opulent/shared';
import { and, eq, ne } from 'drizzle-orm';
import { ApiError } from '../../lib/http';

export async function getUserByHandle(db: Database, handle: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
  return rows[0];
}

export async function updateProfile(
  db: Database,
  userId: string,
  input: UpdateProfileInput,
): Promise<UserRow> {
  if (input.handle) {
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.handle, input.handle), ne(users.id, userId)))
      .limit(1);
    if (taken.length > 0) {
      throw ApiError.conflict('That handle is already taken');
    }
  }

  const updated = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  const user = updated[0];
  if (!user) throw ApiError.notFound('User not found');
  return user;
}
