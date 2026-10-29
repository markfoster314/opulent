This file adds rules for `jobs/card-sync`. Tree and run steps: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/card-sync typecheck
pnpm exec vitest run jobs/card-sync/src/<file>.test.ts
```

A real run is `pnpm cards:sync`. It needs `DATABASE_URL` plus `SCRYFALL_USER_AGENT`. Vitest project name is `card-sync`.

# Sync

Tests in `src/scryfall.test.ts` and `src/importer.test.ts` must not call Scryfall or Postgres.

Writes are upserts. The collection-value query stays in `packages/db`. This job does not import an app or `infra`.
