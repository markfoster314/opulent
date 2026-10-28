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

interface PublicConfig {
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0Audience?: string;
  apiBaseUrl?: string;
}

/** Production reads /config.json written at deploy, so the API address is not baked in at build time. */
export async function loadPublicEnv(): Promise<void> {
  if (import.meta.env.DEV) return;

  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Missing /config.json');

  const remote = (await response.json()) as PublicConfig;
  if (!remote.auth0Domain || !remote.auth0ClientId || !remote.auth0Audience || !remote.apiBaseUrl) {
    throw new Error('/config.json is missing a public setting');
  }

  env.auth0Domain = remote.auth0Domain;
  env.auth0ClientId = remote.auth0ClientId;
  env.auth0Audience = remote.auth0Audience;
  env.apiBaseUrl = remote.apiBaseUrl;
}
