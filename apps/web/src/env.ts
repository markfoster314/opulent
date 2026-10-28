/** Vite exposes only VITE_ vars, so these are public; fail fast instead of redirecting to "undefined". */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in the .env file at the monorepo root, then restart the dev ` +
        `server, because Vite reads .env only at startup.`,
    );
  }
  return value;
}

const raw = import.meta.env as Record<string, string | undefined>;

export const env = {
  auth0Domain: required('VITE_AUTH0_DOMAIN', raw.VITE_AUTH0_DOMAIN),
  auth0ClientId: required('VITE_AUTH0_CLIENT_ID', raw.VITE_AUTH0_CLIENT_ID),
  auth0Audience: required('VITE_AUTH0_AUDIENCE', raw.VITE_AUTH0_AUDIENCE),
  apiBaseUrl: raw.VITE_API_BASE_URL ?? 'http://localhost:8787',
};
