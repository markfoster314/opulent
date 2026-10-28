# @opulent/web

React SPA. Install and run from the repo root. Not a standalone package.

React 19, Vite 8, MUI 9, React Router 7, TanStack Query 5, Auth0 SPA SDK, Recharts. Contracts from `@opulent/shared`.

## Run

```bash
pnpm dev
```

Web http://localhost:5173. API http://localhost:8787. Vite reads `.env` from the repo root (`envDir`). Missing `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, or `VITE_AUTH0_AUDIENCE` throws at boot. `VITE_API_BASE_URL` defaults to `http://localhost:8787`. A production build reads those four values from `/config.json` before it renders.

UI only, no database or Auth0:

```bash
pnpm --filter @opulent/web dev:mock
```

Signed-in session, fixtures in `src/mocks`. **Mocks** (bottom left) sets Ok, Empty, Slow, 401, 404, 500, or Offline for every `/v1` call. `pnpm dev` has no panel.

| Command                                | Use                            |
| -------------------------------------- | ------------------------------ |
| `pnpm --filter @opulent/web build`     | `apps/web/dist`                |
| `pnpm --filter @opulent/web typecheck` | This package                   |
| `pnpm test` / `pnpm test:e2e`          | Vitest here, Playwright `/e2e` |

Lint, test, and format are root commands.

## Tree

```text
src/
  app/       routes, providers, env
  layout/    shell
  api/       fetch client, query keys
  theme/
  shared/    cards, binder, ui, hooks
  features/  home, auth, collection, groups, wants, matches, trades, profile
```

`@/` is `src/`. Providers wrap `App` in `src/app/main.tsx`. Routes are in `src/app/App.tsx`.

| Feature      | Owns                                     |
| ------------ | ---------------------------------------- |
| `home`       | Signed-in hub. Signed-out visitors land. |
| `auth`       | Landing, welcome, pending add            |
| `collection` | Overview, binder, table, import          |
| `groups`     | One private group                        |
| `wants`      | Lists, global wants, shared URLs, import |
| `matches`    | Match owners                             |
| `trades`     | Open, past, one trade                    |
| `profile`    | Public profile, followers, trade binder  |

Features stay flat. No `utils/`, `pages/`, or `components/`. Tests sit next to source.

## Imports

Feature `index.ts` exports pages and the few components other layers need. No `export *`. `app/` and `layout/` import from that barrel.

ESLint `boundaries`:

- `shared/` does not import `features/`.
- Features do not import each other, except `groups` → `collection`, `home` → `matches` and `auth`, `collection` → `profile` and `auth`, `profile` → `matches`.
- `queries.ts` may be imported across features.

## Data

`src/api/client.ts` sends `Authorization: Bearer` when a session exists. Share links pass `t`. Query keys: `src/api/queryKeys.ts`. Hooks live in the owning feature. Server state is TanStack Query. No client store.

Query defaults in `main.tsx`: `staleTime` 60s, one retry, no refetch on focus.

## Routes

| Path                                                         | Screen            |
| ------------------------------------------------------------ | ----------------- |
| `/`                                                          | Home, or landing  |
| `/welcome`                                                   | Username and city |
| `/collection`, `/collection/cards`, `/collection/import`     | Collection        |
| `/groups/:groupId`                                           | One group         |
| `/wants`, `/wants/all`, `/wants/:listId`, `/wants/import`    | Wants             |
| `/matches`                                                   | Matches           |
| `/trades`, `/trades/past`, `/trades/:tradeId`                | Trades            |
| `/u/:handle` and `/trade-binder`, `/followers`, `/following` | Profile           |
| `/u/:handle/wants/all`, `/u/:handle/wants/:slug`             | Shared wants      |

`/binders`, `/binders/all`, and `/u/:handle/all` redirect. Nav treats groups as part of collection.

Phone first. `sm` and `md` only add space. Rows wrap. No helper sentence under a section title.

## Tests

Vitest project `web` in the root `vitest.config.mts`. `renderWithProviders` in `src/test/render.tsx`. `.vscode/launch.json` compound **API + Web**. Authenticated Playwright needs `E2E_AUTH0_EMAIL` and `E2E_AUTH0_PASSWORD`.
