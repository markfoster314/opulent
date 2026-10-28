# Monorepo

The repository is a pnpm workspace with Turborepo. Libraries ship TypeScript source. Apps and jobs compile that source when they build.

## Packages

| Package              | Path              | Role                                         |
| -------------------- | ----------------- | -------------------------------------------- |
| `@opulent/shared`    | `packages/shared` | Zod schemas and shared types                 |
| `@opulent/db`        | `packages/db`     | Drizzle schema, client, and database scripts |
| `@opulent/web`       | `apps/web`        | Vite React app                               |
| `@opulent/api`       | `apps/api`        | Hono API                                     |
| `@opulent/card-sync` | `jobs/card-sync`  | Scryfall nightly job                         |
| `@opulent/infra`     | `infra`           | AWS CDK                                      |

`@opulent/shared` is used by web, api, db, and card-sync. `@opulent/db` is used by api and card-sync. Infra has no workspace package dependencies.

The GitHub repository is `opulent`. A local folder may use the product name `opulentTutor`.

## Why shared and db have no `build`

These are Just-in-Time packages. Their `package.json` `exports` point at `.ts` files. Vite, `tsx`, and the API esbuild bundle compile that source.

Do not add a `build` script to `@opulent/shared`, `@opulent/db`, or `@opulent/infra`. Turbo `typecheck` depends on `^typecheck`. Turbo `build` stays on `^build` and only writes `dist/**` for api, web, and card-sync. Infra uses `synth`, not `build`.

## Root commands

| Command            | Use                                                          |
| ------------------ | ------------------------------------------------------------ |
| `pnpm check`       | Format, lint, typecheck, and unit tests. No Docker or Auth0. |
| `pnpm check:ci`    | Same gates as the Quality job, except actionlint.            |
| `pnpm dev`         | API and web. Needs `.env` and PostgreSQL.                    |
| `pnpm build`       | API, web, and card-sync artifacts.                           |
| `pnpm infra:synth` | CDK synth through Turbo.                                     |

Lint, test, and format stay at the repository root. They scan the whole tree. They are not per-package Turbo tasks.

## Package boundaries

ESLint `boundaries` rules in `eslint.config.mjs`:

- An app must not import another app, a job, or infra.
- A package must not import an app, a job, or infra.
- A job must not import an app or infra.
- Infra must not import an app, a package, or a job.

Shared versions that must stay paired live in the pnpm catalog in `pnpm-workspace.yaml`.
