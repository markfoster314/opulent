This file is for the coding agent. People start at [README.md](README.md).

Nested `AGENTS.md` files add rules for that folder. On a conflict, the nearer file wins.

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it. The same rule applies beside any nested `AGENTS.md`.

# Stack

Node `26.13.0` ([.nvmrc](.nvmrc)). pnpm 12 via Corepack. The pin is `packageManager` in [package.json](package.json). TypeScript, Vitest, Prettier, ESLint. Package map: [docs/monorepo.md](docs/monorepo.md).

# Setup

```bash
npm install -g corepack
corepack enable
pnpm install
cp .env.example .env
```

Full product also needs Postgres: `docker compose up -d postgres`, then the database steps in [README.md](README.md).

# Commands

## File-scoped (preferred)

```bash
pnpm exec eslint path/to/file.ts
pnpm exec prettier --check path/to/file.ts
pnpm exec vitest run path/to/file.test.ts
```

Swap `path/to/file` for the file you changed.

## Full suite (only when the change needs it, and only after a yes)

```bash
pnpm check
pnpm dev
pnpm test:e2e
pnpm smoke
```

`pnpm check` is format, lint, types, and unit tests. No Docker or Auth0. `pnpm test:e2e` is for a browser change. `pnpm smoke` is for a database change.

# Code style

- Prettier: single quotes, semicolons, print width 100. See [`.prettierrc.json`](.prettierrc.json).
- ESLint allows zero warnings. Do not add `eslint-disable` to hide a new problem.
- A comment earns its place only when it explains why, flags a gotcha, or cites an external constraint.
- New dependency versions go in the pnpm catalog in `pnpm-workspace.yaml`. Workspace packages use `workspace:*`.
- `@opulent/shared` and `@opulent/db` export TypeScript source. Do not add a `build` script to those packages or to `@opulent/infra`.

# Packages

- `@opulent/web` — [apps/web/AGENTS.md](apps/web/AGENTS.md)
- `@opulent/api` — [apps/api/AGENTS.md](apps/api/AGENTS.md)
- `@opulent/shared` — [packages/shared/AGENTS.md](packages/shared/AGENTS.md)
- `@opulent/db` — [packages/db/AGENTS.md](packages/db/AGENTS.md)
- `@opulent/card-sync` — [jobs/card-sync/AGENTS.md](jobs/card-sync/AGENTS.md)
- `@opulent/infra` — [infra/AGENTS.md](infra/AGENTS.md)

An app does not import another app, a job, or infra. A package does not import an app, a job, or infra. A job does not import an app or infra. Infra imports no workspace package.

# Security

Copy `.env.example` to `.env`. Production secrets stay in AWS Secrets Manager. Never commit a password, token, or live database URL. Do not log an `Authorization` header, a request body, or an email.

# Permissions

## Allowed without prompting

- Read files
- Lint, format, or type-check one file
- Run one unit test file

## Ask first

- Install or upgrade a package
- `git commit` or `git push`
- Delete a file
- `pnpm check`, `pnpm build`, `pnpm test:e2e`, or `pnpm smoke`
- `pnpm db:push`, `pnpm db:seed`, or `pnpm db:reset`
- Deploy or destroy a stack
- Edit `.github/workflows/`. A job `if` must be a string. actionlint rejects a constant `false`. Use a repository variable comparison instead. actionlint runs in CI only.

# Pull requests

Conventional Commits. Branch from `main`. Steps: [CONTRIBUTING.md](CONTRIBUTING.md). CI: [.github/workflows/ci.yml](.github/workflows/ci.yml). Production deploy is **Actions → Deploy → Run workflow**, not a push to `main`. Details: [docs/deploy.md](docs/deploy.md).

# When stuck

If the same check fails twice, or the right command is unclear, ask. Do not guess a secret or a production change.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.

<!-- END:turborepo-agent-rules -->
