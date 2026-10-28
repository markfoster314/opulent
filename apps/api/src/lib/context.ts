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
    requestId?: string;
    /** Set when the response is an error, so the access log can name it. */
    failure?: { code: string; message: string };
    db: Database;
    /** Present after requireAuth. */
    auth: Auth0Claims;
    /** Present after requireUser. */
    user: UserRow;
  };
}
