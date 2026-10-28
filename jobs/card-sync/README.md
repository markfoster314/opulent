# @opulent/card-sync

Nightly Scryfall mirror. One process locally, one Fargate task when deployed. The task image is Node 26. Install and run from the repo root. Not a standalone package.

The task and `pnpm cards:sync` both use bulk type `all_cards` unless `SCRYFALL_BULK_TYPE` is set. That file includes non-English printings.

## Run

Postgres, then:

```bash
pnpm cards:sync
```

Needs `DATABASE_URL` in the repo-root `.env`, or `DB_SECRET_ARN` and `DB_HOST`. `SCRYFALL_USER_AGENT` should name this app and a contact URL. `SCRYFALL_MAX_ROWS` caps how many cards a local run reads. The deployed task does not set it.

A second run exits while the first still holds its database lock. Card writes, today's price row, and the value snapshot all update on conflict, so a failed run is safe to start again.

| Command                                      | Use                         |
| -------------------------------------------- | --------------------------- |
| `pnpm --filter @opulent/card-sync typecheck` | This package                |
| `pnpm --filter @opulent/card-sync build`     | `jobs/card-sync/dist`       |
| `pnpm test`                                  | Vitest, project `card-sync` |

Lint, test, and format are root commands. Deploy: [infra/README.md](../../infra/README.md).

## Tree

```text
src/
  index.ts      lock, import, prices, snapshots, then exit
  scryfall.ts   bulk listing and the gzipped download
  importer.ts   batches of 500 upserts
  prices.ts     one price row per change
  catalog.ts    source shape for a later game
```

The collection-value query lives in `packages/db`. The API uses that same query.

## Tests

`src/scryfall.test.ts` checks field mapping. `src/importer.test.ts` checks the batch flush, skipped rows, and a row for the wrong game. Neither test calls Scryfall or Postgres.
