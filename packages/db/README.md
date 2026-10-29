# @opulent/db

Drizzle schema, migrations, and seed. Install and run from the repo root. Not a standalone package.

Production RDS is PostgreSQL 16. Local Postgres is the PostGIS 17 image in `docker-compose.yml`. The API and `jobs/card-sync` import this package. Source is TypeScript. There is no build step.

## Run

Postgres first (`docker compose up -d postgres`). `DATABASE_URL` in the repo `.env` is required. Drizzle does not guess a URL.

```bash
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap
pnpm db:seed
```

Bootstrap runs twice: once so extensions exist, again after migrate so indexes exist.

| Command             | Use                                             |
| ------------------- | ----------------------------------------------- |
| `pnpm db:generate`  | Write a migration from the schema               |
| `pnpm db:migrate`   | Apply migrations                                |
| `pnpm db:drift`     | Fail if generate would change SQL               |
| `pnpm db:bootstrap` | Extensions and indexes                          |
| `pnpm db:seed`      | Demo people. Local host only                    |
| `pnpm db:reset`     | Empty app tables, then seed. Local only         |
| `pnpm db:push`      | Push the schema without a migration. Local only |
| `pnpm db:studio`    | Row browser                                     |
| `pnpm places:sync`  | GeoNames city list                              |

Cities come from [GeoNames](https://www.geonames.org/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

`db:seed`, `db:reset`, and `db:push` refuse any host other than `localhost`, `127.0.0.1`, or `::1`. `ALLOW_REMOTE_DB=1` overrides that.

Demo users use a `seed|` subject. See [docs/auth0-development.md](../../docs/auth0-development.md).

Lint, test, and format are root commands. Repo map: [README.md](../../README.md).

## Tree

```text
src/schema/            tables
migrations/            SQL files
drizzle.config.ts
src/bootstrap-sql.ts   extensions and indexes
src/seed.ts            demo data
src/reset.ts           truncate, then seed
src/migrate-aws.ts     Lambda entry
src/connection-string.ts
```
