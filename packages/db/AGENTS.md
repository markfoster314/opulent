This file adds rules for `packages/db`. Command list: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/db typecheck
pnpm exec vitest run packages/db/src/local-only.test.ts
```

Swap the test path for the file you changed. Vitest project name is `db`. These tests do not need a live database.

# Schema

There is no build step. Do not add a `build` script. Tables live in `src/schema/`.

After a schema edit:

```bash
pnpm db:generate
pnpm db:migrate
```

Commit the new SQL in `migrations/` with the schema change. CI runs `pnpm db:drift`.

`pnpm db:bootstrap` runs before migrate and again after it. `db:seed`, `db:reset`, and `db:push` allow only `localhost`, `127.0.0.1`, or `::1`. Ask before any of those three.

# Good

- Local-only guard: `src/local-only.ts`
- Table definitions: `src/schema/index.ts`

# Avoid

- `pnpm db:push` against any host that is not local
- A migration written by hand when `pnpm db:generate` can write it

# When stuck

Ask before bootstrap, seed, reset, or push. A wrong database command wipes rows.
