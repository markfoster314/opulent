# Opulent Tutor

**A trade binder for Magic: The Gathering players: list the cards you will trade, share one link, and see which cards your friends are hunting for.**

This README is the onboarding path for a new engineer. It covers what the product is, where the code lives, how the system fits together, how to run it, and how to ship changes safely.

## Project status

The core product is built:

- account onboarding and public profiles
- collection stacks with table and binder views
- private groups for labelling collection stacks
- global wants, want lists, specifications, and matching
- public trade binders and share links
- trade proposals and trade history
- CSV import and export
- nightly Scryfall card mirror and price history

Still in progress:

- automated production deployment and web asset publishing
- authenticated browser coverage against a dedicated Auth0 test tenant
- broader API and UI test coverage

The repository is a pnpm workspace managed by Turborepo. It is designed to run locally on a phone-sized browser first and on a wider window second.

---

## 1. Start here

### Requirements

- **Node.js 24** (`nvm use` reads [.nvmrc](.nvmrc))
- **pnpm 10 through Corepack**

For the full local product, also use:

- **Docker** for PostgreSQL with PostGIS
- An **Auth0 development tenant** for signed-in work. Follow [docs/auth0-development.md](docs/auth0-development.md).

```bash
corepack enable
node --version      # v24.x
pnpm --version      # 10.x
```

The GitHub repository is `opulent`. A local folder may use the product name `opulentTutor`.

### Quality only

No Docker, Auth0, or card download.

```bash
git clone https://github.com/markfoster314/opulent.git
cd opulent

corepack enable
pnpm install
pnpm check
```

`pnpm check` runs formatting, ESLint, TypeScript, and unit tests. Use `pnpm check:ci` to match the Quality job, except actionlint.

### Full local product

```bash
docker --version
docker compose up -d postgres
cp .env.example .env
```

Fill `.env` with the development Auth0 values. The web app fails fast if `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, or `VITE_AUTH0_AUDIENCE` is missing.

Prepare the database:

```bash
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap
```

The bootstrap step runs twice on purpose:

1. First pass creates extensions such as PostGIS.
2. Second pass creates indexes that require the tables to exist.

Load reference data (optional for quality work; required to use the product):

```bash
pnpm places:sync
pnpm cards:sync
```

`places:sync` downloads the GeoNames city list. `cards:sync` streams the Scryfall bulk card file into the local mirror. The card sync needs `SCRYFALL_USER_AGENT` in `.env`; Scryfall requires an accurate User-Agent.

Optional demo data:

```bash
pnpm db:seed
```

This creates seeded users, collections, groups, wants, friendships, and trades for local testing. It replaces data owned by the seeded demo users. Do not run it against a database whose demo data you want to keep.

Verify the database:

```bash
pnpm smoke
```

### Run the apps

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

Use `pnpm smoke` for database checks and `pnpm test:e2e` for browser checks.

---

## 2. What lives where

| Path                 | Responsibility                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`           | React single-page application. Pages, shared UI components, browser API client, Auth0 provider, theme.                      |
| `apps/api`           | Hono API. One HTTP service, deployed as one AWS Lambda.                                                                     |
| `packages/shared`    | Zod schemas, TypeScript types, enums, pricing helpers, want-scope keys, CSV formats. Shared by both apps.                   |
| `packages/db`        | PostgreSQL schema, Drizzle client, migrations, bootstrap, seed, place import, price partitions.                             |
| `jobs/card-sync`     | Scryfall bulk-data download and database upsert. Runs as a scheduled ECS Fargate task.                                      |
| `infra`              | AWS CDK infrastructure in TypeScript.                                                                                       |
| `e2e`                | Playwright public and optional authenticated browser tests.                                                                 |
| `docs`               | Engineering guides: [monorepo](docs/monorepo.md), [GitHub setup](docs/github-setup.md), [Auth0](docs/auth0-development.md). |
| `.github`            | CI, security workflows, CODEOWNERS, pull request and issue templates.                                                       |
| `docker-compose.yml` | Local PostgreSQL 16 with PostGIS.                                                                                           |
| `.env.example`       | Required environment variables. Copy to `.env`; never commit `.env`.                                                        |

### Web app map

- `src/pages` holds route screens.
- `src/components` holds shared UI: tables, binders, detail views, add/edit panels, trade panels.
- `src/api/client.ts` is the typed fetch wrapper.
- `src/api/queries.ts` holds TanStack Query hooks and cache invalidation.
- `src/binderSearch.ts` holds collection table-binder search state.
- `src/wantBrowser.ts` holds want sorting.
- `src/theme` holds the gold-on-dark MUI theme.

Important route groups:

- `/collection`, `/collection/cards`, `/collection/import`
- `/groups/:groupId`
- `/wants`, `/wants/all`, `/wants/:listId`, `/wants/import`
- `/matches`
- `/trades`, `/trades/past`, `/trades/:tradeId`
- `/u/:handle`, `/u/:handle/trade-binder`, shared want list URLs
- `/welcome` for first-time username setup

### API map

- `src/app.ts` creates the Hono app and middleware.
- `src/index.ts` runs the local Node server.
- `src/lambda.ts` exports the Lambda handler.
- `src/env.ts` validates API environment variables at boot.
- `src/middleware/auth.ts` verifies Auth0 bearer tokens and maps them to user rows.
- `src/modules` contains one folder per domain:
  - `cards`, `collection`, `groups`, `wants`, `matches`, `places`, `trades`, `users`, `health`
- Each module has routes and service functions. Services own database access; routes own HTTP concerns.

API route prefixes:

```text
/health
/v1/users
/v1/places
/v1/cards
/v1/collection
/v1/matches
/v1/groups
/v1/wants
/v1/trades
```

---

## 3. Technical architecture, front to back

```text
Browser
  |
  |  React + Vite + MUI + TanStack Query
  |  Auth0 SPA SDK (Authorization Code + PKCE)
  v
CloudFront + S3  (static SPA)
  |
  |  HTTPS + Bearer access token
  v
API Gateway HTTP API
  |
  v
AWS Lambda (Hono)
  |  JWT verification with Auth0 JWKS
  |  Zod request validation
  |  domain service functions
  v
RDS Proxy
  |
  v
PostgreSQL 16 + PostGIS

EventBridge (06:00 UTC)
  |
  v
ECS Fargate card-sync  --->  Scryfall bulk JSONL
  |
  v
cards + card_price_history
```

Card images do not pass through the API. The database stores Scryfall image URLs, and the browser loads images directly from Scryfall’s CDN.

### Front end

- **React 18**, **Vite 8**, **MUI 6**, **React Router 7**, **TanStack Query 5**, **Recharts**.
- Auth0 SPA SDK handles login, logout, refresh tokens, and access tokens. Tokens are stored with `cacheLocation="localstorage"` so a refresh does not force a new login.
- The API client attaches `Authorization: Bearer <token>` when a signed-in session exists. Public pages still work without a token.
- TanStack Query owns server state. Mutations invalidate the relevant query keys so collection, group, want, and trade screens stay in sync.
- Collection and wants screens share table/binder patterns. The collection table expands a row; the binder opens a modal. Both use the same detail component for a given domain.
- The layout is phone-first. Rows of buttons and filters wrap or stack. The owner checks the visual result in a browser; do not assume a desktop-only layout.

### API

- **Hono 4** on Lambda, with a Node server entry for local development.
- Request middleware adds request IDs, logging, secure headers, CORS, and a no-store cache policy for personal `/v1/*` data.
- Auth middleware verifies the JWT issuer and audience with the tenant JWKS. It then finds or creates the local user row from the Auth0 `sub`.
- Zod schemas in `@opulent/shared` validate request bodies at the API boundary and type the client/server contracts.
- Service functions enforce ownership by user ID. Modules call services; they do not import another module’s tables.
- The API is bundled with esbuild into `apps/api/dist/lambda.mjs` for deployment.

### Data

- **PostgreSQL 16 + PostGIS** on RDS.
- **Drizzle ORM** owns schema, queries, migrations, and relations.
- `cards` is a local mirror of paper Scryfall printings. Search and card lookup do not call Scryfall at request time.
- `card_price_history` stores daily change points. Readers carry the last price forward.
- `collection_items` represents one physical stack. A stack is identified by printing, finish, condition, language, and the five copy marks. Quantity and price settings live on the stack.
- `card_groups` and `group_memberships` are labels. Deleting a group does not delete its cards.
- `want_items` are global card concepts with quantity, priority, notes, and optional language/printing/condition/set filters. `want_lists` and `want_list_items` are labels over those wants.
- `generic_wants` represent broader interests that can match several printings.
- `trades` and `trade_items` connect two users and the cards they offered.
- `friendships` and `places` support the social and radius-search features.
- RDS Proxy requires prepared statements to be disabled in the Drizzle client. That is intentional.

### Background data

`jobs/card-sync` streams the Scryfall bulk JSONL archive, gunzips it, and upserts card rows in batches. It also seeds price history points. The scheduled ECS task runs at 06:00 UTC, after Scryfall’s usual nightly rebuild.

Scryfall requires an accurate `User-Agent` and an `Accept` header. The job sends both. Do not remove them.

### Infrastructure

`infra` is AWS CDK in TypeScript:

- VPC with two availability zones and one NAT gateway
- RDS PostgreSQL with PostGIS, encrypted storage, and backups
- RDS Proxy for Lambda connection pooling
- one Lambda for the API
- API Gateway HTTP API with CORS
- S3 + CloudFront for the static SPA
- ECS Fargate task for card sync
- EventBridge schedule for the nightly sync
- CloudWatch logs

The stack is synthesized with `pnpm infra:synth`. A deployment requires AWS credentials, CDK bootstrap, and stage-specific Auth0/CORS context values.

> Deployment is currently manual. CI verifies synthesis but does not deploy. The CDK stack creates the web bucket and distribution; uploading `apps/web/dist` is not yet automated by the stack. Confirm that step before treating a deploy as complete.

---

## 4. Authentication for local development

Use a separate Auth0 development tenant. The full steps are in [docs/auth0-development.md](docs/auth0-development.md).

Minimum setup:

1. Create a **Single Page Application**.
2. Allow callback and logout URLs for `http://localhost:5173` and `http://127.0.0.1:5173`.
3. Create an API whose identifier matches `AUTH0_AUDIENCE`.
4. Enable offline access for refresh tokens.
5. Create a database test user with MFA and CAPTCHA disabled.

The API and web values must match:

```env
AUTH0_DOMAIN=your-dev-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.opulenttutor.com

VITE_AUTH0_DOMAIN=your-dev-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.opulenttutor.com
```

If you want seeded data under your real login, map the test Auth0 `sub` to a seeded user row in the development database. The `mark` seed user already uses an `auth0|...` subject. Other demo users use subjects such as `seed|ava_lane`. A login that does not match a seed subject creates an empty account.

### Authenticated browser tests

The Playwright `authenticated` project signs in with:

```bash
E2E_AUTH0_EMAIL=you@example.com
E2E_AUTH0_PASSWORD=your-test-password
```

It saves the session to `playwright/.auth/user.json` and reuses it. When those values are absent, the setup and authenticated tests are skipped; public browser tests still run.

The storage state contains access and refresh tokens. It is ignored by Git. Never commit or share it.

---

## 5. Useful commands

| Command               | What it does                                               |
| --------------------- | ---------------------------------------------------------- |
| `pnpm dev`            | Runs the API and web app with Turbo                        |
| `pnpm build`          | Builds API, web, and card-sync artifacts                   |
| `pnpm check`          | Format check, ESLint, TypeScript, and unit tests           |
| `pnpm check:ci`       | Quality job gates, except actionlint                       |
| `pnpm lint`           | ESLint across the repository                               |
| `pnpm lint:fix`       | ESLint with automatic fixes                                |
| `pnpm format`         | Prettier write                                             |
| `pnpm format:check`   | Prettier check                                             |
| `pnpm typecheck`      | Type-check tooling plus every workspace package            |
| `pnpm test`           | Vitest unit tests                                          |
| `pnpm test:watch`     | Vitest watch mode                                          |
| `pnpm test:coverage`  | Vitest with coverage report                                |
| `pnpm test:e2e`       | Playwright public and optional authenticated tests         |
| `pnpm smoke`          | Database integration checks; needs PostgreSQL              |
| `pnpm check:packages` | manypkg workspace validation                               |
| `pnpm knip`           | Finds unused files, exports, and dependencies              |
| `pnpm db:bootstrap`   | Creates extensions and indexes                             |
| `pnpm db:generate`    | Generates a Drizzle migration from schema changes          |
| `pnpm db:migrate`     | Applies pending migrations                                 |
| `pnpm db:drift`       | Fails if the schema has changes that are not in migrations |
| `pnpm db:seed`        | Replaces data owned by the seeded demo users               |
| `pnpm db:reset`       | Resets the local database; destructive                     |
| `pnpm db:studio`      | Opens Drizzle Studio                                       |
| `pnpm places:sync`    | Refreshes the GeoNames city list                           |
| `pnpm cards:sync`     | Refreshes the Scryfall card mirror                         |
| `pnpm infra:synth`    | Synthesizes the CDK stack without AWS credentials          |

### Database warnings

- `pnpm db:push` is for local prototyping only. Do not run it against a shared or production database.
- `pnpm db:seed` and `pnpm db:reset` are destructive in their scope.
- Schema changes must include a generated migration committed with the schema change.
- CI runs `pnpm db:drift` to catch schema changes that were not turned into a migration.

---

## 6. Testing and CI

### Test layers

- **Vitest** — pure functions and small component behavior.
- **Database smoke test** — real PostgreSQL/PostGIS queries through the service layer.
- **Playwright** — public browser smoke tests, plus optional Auth0-authenticated tests.

Unit tests do not need Auth0 or PostgreSQL. The smoke test needs PostgreSQL with PostGIS. Playwright starts the Vite dev server itself.

### CI

GitHub Actions runs:

- **Quality** — format check, ESLint, typecheck, coverage, build, manypkg, Knip, CDK synth, actionlint.
- **Database** — bootstraps a PostGIS service, applies migrations, checks migration drift, runs the smoke test.
- **Browser smoke** — Playwright public tests; authenticated tests run when the Auth0 test-tenant values are configured.
- **Analyze** — CodeQL.
- **Dependency Review** — high-severity dependency review on pull requests.
- **Secret scan** — gitleaks.
- **Production dependency audit** — `pnpm audit --prod`.

Pull requests also require a Conventional Commit-style title (**PR title**).

Required checks and branch protection rules are in [docs/github-setup.md](docs/github-setup.md). The short version: protect `main`, require a pull request and one approval, and require **Quality**, **Database**, **Secret scan**, and **Production dependency audit**. Add **Analyze** and **Dependency Review** when GitHub Advanced Security is on. **Browser smoke** stays optional until its run history is stable.

### Remote build cache

Turborepo can share task results across laptops and CI. This is optional but useful for a distributed team.

```bash
pnpm exec turbo login
pnpm exec turbo link
```

CI reads `TURBO_TOKEN` from repository secrets and `TURBO_TEAM` from repository variables. Do not put the token in `.env`; Turbo does not read the app `.env` for this, and a `VITE_` prefix would expose it to the browser. The full list is in [docs/github-setup.md](docs/github-setup.md).

Without those values, CI still runs. It simply does not use the shared cache.

---

## 7. Tools and conventions

### Stack

- Node.js 24, pnpm 10, Turbo 2
- TypeScript 6 with strict settings
- React 18, Vite 8, MUI 6, React Router 7
- Hono 4, Zod 4, Drizzle ORM
- PostgreSQL 16 + PostGIS
- Auth0
- AWS CDK
- Docker for local PostgreSQL and the card-sync image

### Quality tools

- **ESLint 10** with type-aware rules, React hooks, package boundaries, and Turbo environment checks
- **Prettier** for formatting
- **Vitest** and Testing Library
- **Playwright**
- **Husky** and **lint-staged** for commit checks
- **Commitlint** for Conventional Commits
- **Renovate** for grouped dependency updates
- **manypkg** and pnpm catalogs for workspace consistency
- **Knip** for dead code and dependency checks
- **CodeQL**, **Dependency Review**, and **gitleaks** for security

### Repository conventions

- Branch from `main`; use a short-lived feature branch.
- Use Conventional Commits, such as `feat(wants): add binder view`.
- Squash merge only.
- Add or update tests for behavior changes.
- Keep shared dependency versions in the pnpm catalog.
- Run `pnpm check` before opening a pull request.
- Never commit `.env`, Auth0 storage state, credentials, or generated build output.
- Follow the [comment policy](AGENTS.md): comments must explain why, a trade-off, a gotcha, or an external constraint.

---

## 8. Deployment

The current deployment path is manual:

```bash
pnpm build
pnpm --filter @opulent/infra exec cdk bootstrap
pnpm --filter @opulent/infra run deploy -- \
  --context stage=dev \
  --context auth0Domain=your-dev-tenant.us.auth0.com \
  --context auth0Audience=https://api.opulenttutor.com \
  --context corsOrigin=https://your-web-origin
```

Before deploying:

- Use a stage-specific Auth0 tenant.
- Confirm the API Lambda artifact exists in `apps/api/dist`.
- Confirm the web build is uploaded to the stack’s S3 bucket and the CloudFront distribution is invalidated. The current CDK stack does not automate that upload.
- Confirm database migrations have been applied through the approved process.

CI does not deploy today. It validates formatting, types, tests, builds, migration drift, and CDK synthesis.

---

## 9. Troubleshooting

**`Invalid or missing environment variables`**

- The API validates `.env` at boot. Copy `.env.example` to `.env` and fill the Auth0/database values.

**The web app shows a missing Auth0 variable**

- Vite reads `.env` from the repository root at startup. Set `VITE_AUTH0_*` and restart `pnpm dev`.

**Auth0 login returns to the wrong URL**

- Add the exact local origin and callback URL to the Auth0 SPA settings. See [docs/auth0-development.md](docs/auth0-development.md).

**PostGIS or radius search fails**

- Confirm the Docker PostGIS container is running.
- Run `pnpm db:bootstrap` again after migrations.

**Seed data does not belong to my login**

- The `mark` seed user already uses an `auth0|...` subject. Other demo users use subjects such as `seed|ava_lane`. Map your development Auth0 `sub` to a seeded row, or create a fresh account.

**`pnpm smoke` cannot connect**

- Start PostgreSQL with `docker compose up -d postgres`.
- Confirm `DATABASE_URL` points at the local container.

**Authenticated Playwright tests are marked skipped**

- Set `E2E_AUTH0_EMAIL` and `E2E_AUTH0_PASSWORD`.
- For CI, also set the `E2E_AUTH0_DOMAIN`, `E2E_AUTH0_CLIENT_ID`, and `E2E_AUTH0_AUDIENCE` repository variables.

**Remote cache is not used**

- Run `pnpm exec turbo login` and `pnpm exec turbo link` locally.
- In CI, set the `TURBO_TOKEN` secret and `TURBO_TEAM` variable.

**`pnpm install` fails with a frozen lockfile**

- A dependency manifest changed without updating the lockfile. Run `pnpm install` and commit the resulting `pnpm-lock.yaml`.

---

## 10. Credits

Card data and images courtesy of [Scryfall](https://scryfall.com). Opulent Tutor is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy, and is not produced or endorsed by Wizards of the Coast or Scryfall.

City names and coordinates come from [GeoNames](https://www.geonames.org/), used under the [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) license.

Auth0 provides identity. AWS provides the runtime infrastructure.
