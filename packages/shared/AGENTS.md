This file adds rules for `packages/shared`. Contract list: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/shared typecheck
pnpm exec vitest run packages/shared/src/user.test.ts
```

Swap the test path for the file you changed. Vitest project name is `shared`.

# Code style

This package is the Zod contract for the API and the web app. There is no build step. Export source from `src/index.ts`.

Change a schema here when both sides need the same shape. Do not copy the type into an app. Do not add a `build` script.

# Good

- Username rules: `src/user.ts`
- Public exports: `src/index.ts`

# Avoid

- A second Zod object in `apps/web` or `apps/api` for a shape this package already owns
- A `build` script in `package.json`

# When stuck

Ask if a field must differ between the API and the web app. Those two sides share this package.
