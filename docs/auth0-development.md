# Auth0 development setup

Use a separate Auth0 tenant for development and Playwright. Never point automated tests at the production tenant.

## Auth0 tenant

1. Create a development tenant.
2. Create a **Single Page Application**.
3. Set the callback and logout URLs to both local origins:
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
4. Set the web origin to the same values.
5. Enable **Authorization Code** grants and **Refresh Token Rotation**.
6. Create an **API** whose identifier matches `AUTH0_AUDIENCE`.
7. Enable **offline access** on the API so refresh tokens work.
8. Create a database (username/password) test user.
9. Disable MFA and CAPTCHA or bot protection for this test user and tenant.

No Auth0 client secret is needed. The SPA uses Authorization Code with PKCE.

## Environment

Set the API and web values to the same tenant and audience:

```env
AUTH0_DOMAIN=your-dev-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.opulenttutor.com
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

VITE_AUTH0_DOMAIN=your-dev-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.opulenttutor.com
VITE_API_BASE_URL=http://localhost:8787
```

The API verifies JWTs with the tenant JWKS. It does not use an Auth0 client secret.

## Seed data

Seeded users have fake subjects such as `seed|mark`. A real Auth0 login has a subject such as `auth0|...`. If no user row has that subject, the API creates a new empty account.

To use seeded data locally, update one seeded row's `auth0Sub` to the development user's Auth0 subject. Do this only in the development database, never in production.

## Playwright authenticated session

The `authenticated` Playwright project uses `E2E_AUTH0_EMAIL` and `E2E_AUTH0_PASSWORD` from the shell or CI environment. It does not read `.env`.

When both values exist:

1. `e2e/auth.setup.ts` signs in through Auth0 Universal Login.
2. The session is saved to `playwright/.auth/user.json`.
3. The authenticated project reuses that state.

When either value is missing, the setup and authenticated tests are skipped. Public Playwright tests still run.

The state file contains access and refresh tokens. It is ignored by Git. Generate it per machine or per CI run; do not share or commit it.

```bash
E2E_AUTH0_EMAIL=you@example.com \
E2E_AUTH0_PASSWORD='your-test-password' \
pnpm test:e2e
```

## Production rules

- Keep development, staging, and production tenants separate.
- Never add Auth0 passwords or storage state to `.env`, Git, screenshots, or logs.
- Use a dedicated test user with no access to production data.
- Rotate test credentials when a team member leaves.
