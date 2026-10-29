This file adds rules for `infra`. Stack and stage rules: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/infra typecheck
pnpm exec vitest run infra/lib/stage-context.test.ts
```

Those two do not synth the stack. Vitest project name is `infra`.

`pnpm infra:synth` needs `pnpm build` first. Ask before either one. `pnpm --filter @opulent/infra run check` reads `infra/cdk.out` after synth.

# Code style

AWS CDK, not Terraform. One stack, `OpulentTutor-${stage}`. This package imports no workspace package. Do not add a `build` script.

`stage=prod` refuses placeholder Auth0, localhost origins, and missing mail settings. The guard is `lib/stage-context.ts`.

# Deploy

Do not run deploy, diff, or destroy unless asked. Deploy details: [docs/deploy.md](../docs/deploy.md).

# Good

- Prod guard: `lib/stage-context.ts`
- Guard test, no synth: `lib/stage-context.test.ts`

# Avoid

- `pnpm --filter @opulent/infra run deploy`
- `pnpm --filter @opulent/infra run destroy`
- An import from `apps/`, `packages/`, or `jobs/`

# When stuck

Ask before synth, deploy, or destroy. A destroy deletes a real stack.
