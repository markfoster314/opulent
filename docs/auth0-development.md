# Auth0 development

Separate tenant from production. Playwright uses the same rule.

## Tenant

1. Development tenant.
2. Single Page Application. Callback, logout, and web origins: `http://localhost:5173` and `http://127.0.0.1:5173`.
3. Authorization Code and Refresh Token Rotation. Offline access on the API.
4. API identifier = `AUTH0_AUDIENCE`.
5. Database test user. MFA and bot protection off for that user.

No client secret. The SPA uses Authorization Code with PKCE. The API checks JWTs against the tenant JWKS.

## Environment

```env
AUTH0_DOMAIN=your-dev-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.opulenttutor.com
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

VITE_AUTH0_DOMAIN=your-dev-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.opulenttutor.com
VITE_API_BASE_URL=http://localhost:8787
```

## Seed users

`pnpm db:seed` gives `mark` an `auth0|...` subject. Other demo users use `seed|...`. A login whose `sub` is missing creates an empty account. Point a seeded row's `auth0Sub` at the dev subject only in the dev database.

## Playwright

`e2e/auth.setup.ts` reads `E2E_AUTH0_EMAIL` and `E2E_AUTH0_PASSWORD` from the environment, not `.env`. It writes `playwright/.auth/user.json` (tokens; gitignored). Missing either value skips authenticated tests.

```bash
E2E_AUTH0_EMAIL=you@example.com E2E_AUTH0_PASSWORD='your-test-password' pnpm test:e2e
```
