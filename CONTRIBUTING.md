# Contributing

## Setup

Use Node 24 and pnpm through Corepack.

```bash
corepack enable
pnpm install
docker compose up -d postgres
cp .env.example .env
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap
pnpm places:sync
pnpm cards:sync
```

## Before a pull request

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` runs formatting, ESLint, TypeScript, and unit tests. Run the relevant E2E tests when the change affects the browser.

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
- Production AWS access must use GitHub OIDC, never long-lived keys.

## Protected main

`main` requires a pull request, one approval, conversation resolution, and linear history. Required checks are **Quality**, **Database**, **CodeQL**, and **Dependency Review**. **Browser smoke** becomes required once it has a stable run history.

## Review

- Required checks must pass.
- A CODEOWNER review is required for owned paths.
- Resolve conversations before merging.
- Keep `main` releasable.
