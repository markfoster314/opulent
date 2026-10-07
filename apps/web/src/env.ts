/**
 * Vite only exposes variables prefixed with VITE_ to the browser. Anything
 * secret must stay on the server; everything here is public by design.
 */
export const env = {
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN as string,
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID as string,
  auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787',
};
