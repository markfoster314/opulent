# Contributing

## Setup

Use Node 24 and pnpm through Corepack. See [docs/monorepo.md](docs/monorepo.md) for the workspace map.

Quality only (no Docker, Auth0, or card download):

```bash
corepack enable
pnpm install
pnpm check
```

Full local product:

```bash
docker compose up -d postgres
cp .env.example .env
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap
pnpm places:sync
pnpm cards:sync
```

Auth0 steps are in [docs/auth0-development.md](docs/auth0-development.md).

## Before a pull request

```bash
pnpm check
```

`pnpm check` runs formatting, ESLint, TypeScript, and unit tests. `pnpm check:ci` matches the **Quality** job, except actionlint. Run `pnpm test:e2e` when the change affects the browser. Run `pnpm smoke` when the change affects the database.

## Branches and commits

- Branch from `main`.
- Use Conventional Commits, such as `feat(wants): add binder view`.
- Keep pull requests focused.
- Squash merge only.

## Tests

- Add or update a test for behavior changes.
- Use `pnpm test` for unit tests and `pnpm smoke` for database integration.
- Do not commit a test that depends on a personal database or external account.

## Database changes

- Edit the Drizzle schema, then run `pnpm db:generate`.
- Commit the migration and metadata together.
- Apply with `pnpm db:migrate`.
- Never run `pnpm db:push` against a shared or production database.
- CI runs `pnpm db:drift` to catch an uncommitted schema change.

## Environment and secrets

- Never commit `.env` files or secrets.
- Add new variables to `.env.example` and the relevant deployment configuration.
- Production AWS access must use GitHub OIDC, never long-lived keys. That deploy path is not in this repository yet.

## Protected main

Apply the rules in [docs/github-setup.md](docs/github-setup.md). Required checks today: **Quality**, **Database**, **Secret scan**, and **Production dependency audit**. Add **Analyze** and **Dependency Review** when GitHub Advanced Security is on. **Browser smoke** becomes required once it has a stable run history.

## Review

- Required checks must pass.
- A CODEOWNER review is required for owned paths.
- Resolve conversations before merging.
- Keep `main` releasable.
