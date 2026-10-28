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

## Web app folders

`apps/web/src` is split by feature. Do not add a `utils/` folder.

| Folder             | Put here                                    |
| ------------------ | ------------------------------------------- |
| `app/`             | Route table, providers, env                 |
| `layout/`          | Shell, logo, not-found                      |
| `features/<name>/` | Screens and logic owned by one product area |
| `shared/cards/`    | Card chrome used by more than one feature   |
| `shared/binder/`   | Binder search and filter controls           |
| `shared/ui/`       | Small widgets with no product meaning       |
| `shared/hooks/`    | Hooks used by more than one feature         |
| `api/`             | HTTP client, query keys, places search      |
| `theme/`           | MUI theme                                   |

A new file goes in this order:

1. The feature that owns it.
2. `shared/ui` or `shared/hooks` if two features use it and it has no product meaning.
3. `shared/cards` if it is card chrome.
4. `shared/binder` if it is binder search used by collection, groups, and the public trade binder.

Features must not import each other, except:

- `groups` may import `collection` (same binder UI)
- `home` may import `matches` and `auth`
- `collection` may import `profile` (trade binder preview) and `auth` (pending add after login)
- `profile` may import `matches` (matches on a public binder)

Query modules (`queries.ts`) may be imported across features. `shared/` must not import `features/`.

## Package boundaries

ESLint `boundaries` rules in `eslint.config.mjs`:

- An app must not import another app, a job, or infra.
- A package must not import an app, a job, or infra.
- A job must not import an app or infra.
- Infra must not import an app, a package, or a job.

Shared versions that must stay paired live in the pnpm catalog in `pnpm-workspace.yaml`.
