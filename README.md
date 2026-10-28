# Opulent Tutor

Magic: The Gathering trade binder. Collection, wants, matches, public binders, trades.

pnpm workspace, Turborepo. Node 24, pnpm 10 via Corepack. GitHub repo `opulent`. A local folder may be named `opulentTutor`.

## Status

Built: accounts, collection, groups, wants, matches, binders, trades, CSV import/export, nightly Scryfall mirror.

Not built: authenticated browser coverage on a dedicated Auth0 tenant.

## Run

Quality only. No Docker, Auth0, or card download.

```bash
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

Card images load from Scryfall. `jobs/card-sync` upserts the mirror at 06:00 UTC. A green push to `main` deploys production. Setup: [docs/deploy.md](docs/deploy.md).

## Commands

| Command                                        | Use                             |
| ---------------------------------------------- | ------------------------------- |
| `pnpm dev`                                     | API and web                     |
| `pnpm check`                                   | Format, lint, types, unit tests |
| `pnpm check:ci`                                | Quality job, except actionlint  |
| `pnpm test` / `pnpm test:e2e` / `pnpm smoke`   | Unit / browser / database       |
| `pnpm db:generate` / `db:migrate` / `db:drift` | Migrations                      |
| `pnpm infra:synth`                             | CDK synth                       |

CI: Quality, Database, Browser smoke, Analyze, Dependency Review, Secret scan, Production dependency audit, PR title. Required checks: [docs/github-setup.md](docs/github-setup.md).

## Ship

Conventional Commits. Branch from `main`. Squash merge. [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
pnpm build
pnpm --filter @opulent/infra run deploy -- \
  --context stage=dev \
  --context auth0Domain=... \
  --context auth0Audience=... \
  --context auth0ClientId=... \
  --context corsOrigin=...
```

`pnpm build` first. Deploy runs the schema migration and uploads `apps/web/dist`. The site reads `/config.json` for the API address and Auth0 settings. A prod deploy (`stage=prod`) also requires `webOrigin` (https), `emailFrom`, and `resendApiKey`. Optional: `alarmEmail`. Production from GitHub: [docs/deploy.md](docs/deploy.md).

## Credits

Card data: [Scryfall](https://scryfall.com). Unofficial Fan Content under the Wizards of the Coast Fan Content Policy.

Cities: [GeoNames](https://www.geonames.org/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
