import type { Database, UserRow } from '@opulent/db';

export interface Auth0Claims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  scope?: string;
}

export interface AppEnv {
  Variables: {
    db: Database;
    /** Present after requireAuth. */
    auth: Auth0Claims;
    /** Present after requireUser. */
    user: UserRow;
  };
}
