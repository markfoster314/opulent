This file adds rules for `jobs/card-sync`. Tree and run steps: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/card-sync typecheck
pnpm exec vitest run jobs/card-sync/src/importer.test.ts
```

Swap the test path for the file you changed. Vitest project name is `card-sync`.

A real run is `pnpm cards:sync`. It needs `DATABASE_URL` and `SCRYFALL_USER_AGENT` in the repo `.env`. Ask before that run. It downloads a large card file.

# Code style

Tests in `src/scryfall.test.ts` and `src/importer.test.ts` must not call Scryfall or Postgres. Writes are upserts, so a failed run is safe to start again. The collection-value query stays in `packages/db`. This job does not import an app or `infra`.

# Good

- Offline import test: `src/importer.test.ts`
- Field mapping test: `src/scryfall.test.ts`

# Avoid

- A test that fetches from Scryfall or opens Postgres
- An import of `apps/` or `infra/`

# When stuck

Ask before `pnpm cards:sync`. Do not invent a Scryfall token or a user-agent string.
