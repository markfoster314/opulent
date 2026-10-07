/**
 * Vite only exposes variables prefixed with VITE_ to the browser. Anything
 * secret must stay on the server; everything here is public by design.
 *
 * These are read at module load and checked immediately. A missing value used
 * to flow through as the string "undefined" and only surface as a broken
 * redirect to https://undefined/authorize, which says nothing about the cause.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in the .env file at the monorepo root, then restart the dev ` +
        `server, because Vite reads .env only at startup.`,
    );
  }
  return value;
}

export const env = {
  auth0Domain: required('VITE_AUTH0_DOMAIN', import.meta.env.VITE_AUTH0_DOMAIN),
  auth0ClientId: required('VITE_AUTH0_CLIENT_ID', import.meta.env.VITE_AUTH0_CLIENT_ID),
  auth0Audience: required('VITE_AUTH0_AUDIENCE', import.meta.env.VITE_AUTH0_AUDIENCE),
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787',
};
