# Opulent Tutor

Magic: The Gathering trade binder. Collection, wants, matches, public binders, trades.

pnpm workspace, Turborepo. Node 26. pnpm 10.26.1 via Corepack. GitHub repo `opulent`. A local folder may be named `opulentTutor`.

## Status

Built: accounts, collection, groups, wants, matches, binders, trades, CSV import/export, nightly Scryfall mirror.

Not built: authenticated browser coverage on a dedicated Auth0 tenant.

## Run

Quality only. No Docker, Auth0, or card download.

Node 26 does not ship Corepack. Install it once for that Node. Corepack then reads the pnpm pin in `package.json`.

```bash
npm install -g corepack
corepack enable
pnpm install
pnpm check
```

Full local product:

```bash
docker compose up -d postgres
cp .env.example .env
pnpm db:bootstrap && pnpm db:migrate && pnpm db:bootstrap
pnpm places:sync && pnpm cards:sync
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

`places:sync` and `cards:sync` are required to use the product. `cards:sync` needs `SCRYFALL_USER_AGENT`. Auth0: [docs/auth0-development.md](docs/auth0-development.md). UI without the API: `pnpm --filter @opulent/web dev:mock`.

`pnpm db:bootstrap` runs before and after migrate. `pnpm db:seed` replaces demo-user rows. `pnpm db:push` is local only. `pnpm smoke` needs Postgres.

## Layout

| Path              | Role                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `apps/web`        | React SPA. [apps/web/README.md](apps/web/README.md)                                              |
| `apps/api`        | Hono API. One Lambda. [apps/api/README.md](apps/api/README.md)                                   |
| `packages/shared` | Zod schemas and shared types. [packages/shared/README.md](packages/shared/README.md)             |
| `packages/db`     | Drizzle schema, migrations, seed. [packages/db/README.md](packages/db/README.md)                 |
| `jobs/card-sync`  | Scryfall mirror. [jobs/card-sync/README.md](jobs/card-sync/README.md)                            |
| `infra`           | AWS CDK. [infra/README.md](infra/README.md)                                                      |
| `e2e`             | Playwright                                                                                       |
| `docs`            | [Monorepo](docs/monorepo.md), [GitHub](docs/github-setup.md), [Auth0](docs/auth0-development.md) |

API prefixes: `/health`, `/v1/users`, `/v1/places`, `/v1/cards`, `/v1/collection`, `/v1/matches`, `/v1/groups`, `/v1/wants`, `/v1/trades`.

## Shape

Browser → CloudFront/S3 → API Gateway → Lambda (Hono, Auth0 JWKS, Zod) → PostgreSQL 16 + PostGIS.

Card images load from Scryfall. `jobs/card-sync` upserts the mirror at 06:00 UTC. Production deploy is **Actions → Deploy → Run workflow**. Setup: [docs/deploy.md](docs/deploy.md).

## Commands

| Command                                        | Use                             |
| ---------------------------------------------- | ------------------------------- |
| `pnpm dev`                                     | API and web                     |
| `pnpm check`                                   | Format, lint, types, unit tests |
| `pnpm check:ci`                                | Quality job, except actionlint  |
| `pnpm test` / `pnpm test:e2e` / `pnpm smoke`   | Unit / browser / database       |
| `pnpm db:generate` / `db:migrate` / `db:drift` | Migrations                      |
| `pnpm infra:synth`                             | CDK synth                       |

Required checks: [docs/github-setup.md](docs/github-setup.md).

## Ship

Conventional Commits. Branch from `main`. Squash merge. [CONTRIBUTING.md](CONTRIBUTING.md).

Production deploy is **Actions → Deploy → Run workflow**. A push to `main` does not deploy. First-time setup and the one-time deploy command: [docs/deploy.md](docs/deploy.md).
