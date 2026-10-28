# Contributing

Setup and commands: [README.md](README.md). Workspace map: [docs/monorepo.md](docs/monorepo.md).

## Pull requests

- Branch from `main`. Conventional Commits. Squash merge.
- `pnpm check` before opening. `pnpm test:e2e` for browser changes. `pnpm smoke` for database changes.
- Required checks and CODEOWNERS: [docs/github-setup.md](docs/github-setup.md).

## Database

Edit the Drizzle schema, run `pnpm db:generate`, commit the migration with the schema, then `pnpm db:migrate`. CI runs `pnpm db:drift`. Do not `db:push` against a shared database.

## Secrets

Do not commit `.env` or credentials. New variables go in `.env.example`. Production AWS access will use GitHub OIDC. That path is not in this repo yet.
