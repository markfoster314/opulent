This file adds rules for `infra`. Stack and stage rules: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/infra typecheck
pnpm exec vitest run infra/lib/stage-context.test.ts
```

Those two do not synth the stack. Vitest project name is `infra`.

`pnpm infra:synth` needs `pnpm build` first. `pnpm --filter @opulent/infra run check` reads `infra/cdk.out`.

# Deploy

Do not run deploy or destroy unless asked. `stage=prod` refuses placeholder Auth0, localhost origins, and missing mail settings. Details: [README.md](README.md).

This package imports no workspace package. The tool is AWS CDK, not Terraform.
