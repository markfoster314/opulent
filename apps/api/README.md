# @opulent/api

Hono API. One process locally, one Node 26 Lambda when deployed. Install and run from the repo root. Not a standalone package.

Hono 4, Drizzle, Zod contracts from `@opulent/shared`. Auth0 JWKS. PostgreSQL through `@opulent/db`.

## Run

Postgres, then the API on port 8787:

```bash
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm --filter @opulent/api dev
```

`pnpm dev` starts this app and the web app. Needs `.env` at the repo root (`DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`). `pnpm db:studio` opens the rows.

| Command                                | Use                        |
| -------------------------------------- | -------------------------- |
| `pnpm --filter @opulent/api typecheck` | This package               |
| `pnpm --filter @opulent/api build`     | `apps/api/dist/lambda.mjs` |
| `pnpm smoke`                           | Service checks on Postgres |
| `pnpm test`                            | Vitest, project `api`      |

Lint, test, and format are root commands. Repo map: [README.md](../../README.md).

## Tree

```text
src/
  index.ts       local server, port 8787
  lambda.ts      API Gateway handler
  app.ts         routes and middleware
  env.ts
  middleware/    auth, errors
  lib/           http, csv, log
  modules/       users, places, cards, collection, groups, wants, matches, trades, health
  smoke/         service checks, run by smoke-test.ts
  smoke-test.ts  entry for pnpm smoke
```

A module owns `routes.ts` and `service.ts`. Routes own HTTP. Services own the database.

Collection also has `browse.ts`, `items.ts`, `binder.ts`, `rows.ts`, `value.ts`, `import.ts`, `csv.ts`. Wants also has `lists.ts`, `items.ts`, `generic.ts`, `import.ts`. Trades also has `read.ts`, `write.ts`, `notify.ts`. `service.ts` re-exports the public functions.

## Imports

A module may import another module's `service.ts` only. Not its tables, and not a sibling such as `csv.ts` or `value.ts`. Lint rejects that import.

## Logs

One JSON line per request on stdout: `requestId`, `method`, `path`, `status`, `duration`. A failed response also has `code` and `message`. Lambda stdout is CloudWatch. Logs stay two weeks. `pnpm dev` pretty-prints that line. The Lambda bundle stays JSON.

`LOG_LEVEL` sets the level. Default `info` when `NODE_ENV` is `production`, otherwise `debug`.

No `Authorization` header, request body, or email.

## Tests

`pnpm smoke` calls services against the local database. The checks live in `src/smoke/`. The entry is still `src/smoke-test.ts`. It is not a Vitest file.

Vitest covers routes that do not need Postgres. Those tests use Hono `app.request` (`src/app.test.ts`).
