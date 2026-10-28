# Monorepo

pnpm workspace, Turborepo. `@opulent/shared` and `@opulent/db` export TypeScript source. Consumers compile it. Do not add a `build` script to those packages or to `@opulent/infra`. Turbo `build` emits `dist/**` for api, web, and card-sync. Infra uses `synth`.

| Package              | Path              | Role                          |
| -------------------- | ----------------- | ----------------------------- |
| `@opulent/shared`    | `packages/shared` | Zod schemas and shared types  |
| `@opulent/db`        | `packages/db`     | Drizzle schema and DB scripts |
| `@opulent/web`       | `apps/web`        | Vite React app                |
| `@opulent/api`       | `apps/api`        | Hono API                      |
| `@opulent/card-sync` | `jobs/card-sync`  | Scryfall job                  |
| `@opulent/infra`     | `infra`           | AWS CDK                       |

`shared` is used by web, api, db, and card-sync. `db` is used by api and card-sync. Infra depends on no workspace package.

GitHub repo `opulent`. A local folder may be named `opulentTutor`.

| Command            | Use                                                  |
| ------------------ | ---------------------------------------------------- |
| `pnpm check`       | Format, lint, types, unit tests. No Docker or Auth0. |
| `pnpm check:ci`    | Quality job, except actionlint                       |
| `pnpm dev`         | API and web. Needs `.env` and Postgres               |
| `pnpm build`       | API, web, and card-sync artifacts                    |
| `pnpm infra:synth` | CDK synth                                            |

Lint, test, and format run at the repo root. They are not per-package Turbo tasks.

## Boundaries

ESLint `boundaries` in `eslint.config.mjs`:

- An app does not import another app, a job, or infra.
- A package does not import an app, a job, or infra.
- A job does not import an app or infra.
- Infra does not import an app, a package, or a job.

Web folder and feature import rules: [apps/web/README.md](../apps/web/README.md).

Every direct dependency version lives in the pnpm catalog in `pnpm-workspace.yaml`. Packages reference it with `catalog:`. Workspace packages use `workspace:*`.
