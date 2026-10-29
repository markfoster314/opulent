This file adds rules for `packages/shared`. Contract files: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/shared typecheck
pnpm exec vitest run packages/shared/src/<file>.test.ts
```

Vitest project name is `shared`.

# Contract

This package is the Zod contract for the API and the web app. There is no build step. Export source from `src/index.ts`.

Change a shared schema here when both sides need the same shape. Do not copy the type into an app.
