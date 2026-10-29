This file adds rules for `packages/db`. Commands and tree: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it.

# Schema

There is no build step. Schema lives in `src/schema/`. After a schema edit, run `pnpm db:generate`, commit the SQL with the schema, then `pnpm db:migrate`. CI runs `pnpm db:drift`.

`pnpm db:bootstrap` runs before migrate and again after it.

`db:seed`, `db:reset`, and `db:push` allow only `localhost`, `127.0.0.1`, or `::1`.

# Tests

```bash
pnpm exec vitest run packages/db/src/<file>.test.ts
```

Vitest project name is `db`. These tests do not need a live database.
