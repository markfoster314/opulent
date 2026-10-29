This file adds rules for `apps/api`. Tree and run steps: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/api typecheck
pnpm exec vitest run apps/api/src/<file>.test.ts
```

`pnpm smoke` hits Postgres. It is not a Vitest file.

# Modules

A module owns `routes.ts` and `service.ts`. Routes own HTTP. Services own the database. A module may import another module's `service.ts` only.

Validate with Zod objects from `@opulent/shared`. Local entry is `src/index.ts` (port 8787). Deployed entry is `src/lambda.ts`.

# Logs

Logs must not include an `Authorization` header, a request body, or an email.

# Tests

Route tests use Hono `app.request` and do not need Postgres (`src/app.test.ts`). Vitest project name is `api`.
