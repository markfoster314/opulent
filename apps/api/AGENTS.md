This file adds rules for `apps/api`. Tree and run steps: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/api typecheck
pnpm exec vitest run apps/api/src/app.test.ts
```

Swap the test path for the file you changed. `pnpm smoke` hits Postgres and is not a Vitest file. Ask before running it.

# Code style

Hono 4. One process locally, one Node 26 Lambda when deployed.

- A module owns `routes.ts` and `service.ts`. Routes own HTTP. Services own the database.
- A module may import another module's `service.ts` only. Not its tables, and not a sibling such as `csv.ts`.
- Validate with Zod objects from `@opulent/shared`.
- Local entry is `src/index.ts` (port 8787). Deployed entry is `src/lambda.ts`.
- Logs must not include an `Authorization` header, a request body, or an email.

# Tests

Route tests use Hono `app.request` and do not need Postgres. Vitest project name is `api`. Service checks live in `src/smoke/` and run from `src/smoke-test.ts`.

# Good

- Thin route: `src/modules/health/routes.ts`
- Route test with no database: `src/app.test.ts`
- Service boundary: `src/modules/users/service.ts`

# Avoid

- Importing `apps/api/src/modules/collection/value.ts` from another module
- Logging a token, a body, or an email

# When stuck

Ask before `pnpm smoke`, a schema change, or a second failing run.
