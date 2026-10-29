This file is for the coding agent. People should start at [README.md](README.md).

# Personal notes

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it. The same rule applies to an `AGENTS.local.md` beside any nested `AGENTS.md`.

# Setup

Node version is in [.nvmrc](.nvmrc) (`26.13.0`). pnpm is `10.26.1` via Corepack. Full steps: [README.md](README.md).

```bash
npm install -g corepack
corepack enable
pnpm install
```

# Commands

From the repo root:

```bash
pnpm check
pnpm dev
```

Prefer a check on one file:

```bash
pnpm exec eslint path/to/file.ts
pnpm exec prettier --check path/to/file.ts
pnpm exec vitest run path/to/file.test.ts
```

`pnpm check` is format, lint, types, and unit tests. `pnpm dev` starts the API and the web app. Postgres and `.env` setup: [README.md](README.md).

# Packages

Nested `AGENTS.md` files add rules for that folder. They do not replace this file.

- `@opulent/web` in `apps/web`. [apps/web/AGENTS.md](apps/web/AGENTS.md).
- `@opulent/api` in `apps/api`. [apps/api/AGENTS.md](apps/api/AGENTS.md).
- `@opulent/shared` in `packages/shared`. [packages/shared/AGENTS.md](packages/shared/AGENTS.md).
- `@opulent/db` in `packages/db`. [packages/db/AGENTS.md](packages/db/AGENTS.md).
- `@opulent/card-sync` in `jobs/card-sync`. [jobs/card-sync/AGENTS.md](jobs/card-sync/AGENTS.md).
- `@opulent/infra` in `infra`. [infra/AGENTS.md](infra/AGENTS.md).

Boundaries and the full map: [docs/monorepo.md](docs/monorepo.md).

New dependency versions go in the pnpm catalog in `pnpm-workspace.yaml`. Workspace packages use `workspace:*`.

`@opulent/shared` and `@opulent/db` export TypeScript source. Do not add a `build` script to those packages or to `@opulent/infra`.

# Comments

Comment sparingly and keep comments short. A comment earns its place only when it explains WHY a decision was made, flags a non-obvious gotcha, or cites an external constraint. Never restate what the code plainly does. If the code is self-explanatory, leave no comment. Prefer clear variable names and small functions over explanatory comments

# Safety

- Do not commit `.env`.
- Do not run `db:push`, `db:seed`, or `db:reset` against a remote database.
- Do not deploy or destroy a stack unless asked.
- Prefer the file-scoped checks above. Run `pnpm test:e2e` for browser changes and `pnpm smoke` for database changes.

# Pull requests

Branch, commits, and checks: [CONTRIBUTING.md](CONTRIBUTING.md). Do not commit `.env` or credentials.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.

<!-- END:turborepo-agent-rules -->
