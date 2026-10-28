# @opulent/web

**This is the React single-page app.** It is the browser UI for collection, wants, matches, trades, and public share links. Clone and install from the [repository root](../../README.md). Do not treat this folder as a stand-alone npm project.

Stack: React 18, Vite 8, MUI 6, React Router 7, TanStack Query 5, Auth0 SPA SDK, Recharts. Types and request bodies come from `@opulent/shared`.

## Run it

From the repository root, with `.env` filled and the API on port 8787:

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

Vite reads `.env` from the **repository root** (`envDir` in `vite.config.ts`). Restart the dev server after you change a `VITE_` variable. The app throws at boot if `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, or `VITE_AUTH0_AUDIENCE` is missing. `VITE_API_BASE_URL` defaults to `http://localhost:8787`.

Signed-in work needs Auth0: [docs/auth0-development.md](../../docs/auth0-development.md). Public routes still render without a token.

| Command                                | Use                                     |
| -------------------------------------- | --------------------------------------- |
| `pnpm dev`                             | API and web through Turbo               |
| `pnpm --filter @opulent/web build`     | Production bundle to `apps/web/dist`    |
| `pnpm --filter @opulent/web typecheck` | TypeScript for this package             |
| `pnpm test`                            | Unit tests, including `src/**/*.test.*` |
| `pnpm test:e2e`                        | Playwright in `/e2e` (not this folder)  |
| `pnpm lint`                            | ESLint for the whole tree               |

Lint, test, and format run at the repository root. They are not Turbo tasks on this package.

## Tree

```text
apps/web/
  index.html
  vite.config.ts          # @ alias, envDir ../../, port 5173
  public/                 # logo, manifest
  src/
    app/                  # main.tsx, App.tsx routes, env.ts
    layout/               # shell, logo, not-found
    api/                  # fetch client, query keys, places
    theme/                # MUI theme
    shared/
      cards/              # card chrome used by more than one feature
      binder/             # binder search and filter
      ui/                 # widgets with no product meaning
      hooks/
    features/
      home/
      auth/
      collection/
      groups/
      wants/
      matches/
      trades/
      profile/
    test/setup.ts
```

`index.html` loads `src/app/main.tsx`. Providers (Auth0, API client, Query, theme, router) wrap `App`. Routes live in `src/app/App.tsx`.

### Features

| Folder       | Owns                                                        |
| ------------ | ----------------------------------------------------------- |
| `home`       | Signed-in hub. Unsigned visitors see the landing page.      |
| `auth`       | Landing, welcome/username, pending-add after login          |
| `collection` | Collection overview, binder, table, import, stats           |
| `groups`     | One private group page. Reuses the collection binder stack. |
| `wants`      | Want lists, global wants, shared list URLs, import          |
| `matches`    | Match owners and generic matches                            |
| `trades`     | Open trades, past trades, one trade                         |
| `profile`    | Public profile, followers, public trade binder              |

Each feature stays flat. If a feature grows past about 15 files, add one inner folder then.

## Where a new file goes

Use this order:

1. **One feature owns it** — put it in that feature. Example: `WantSortSelect` → `features/wants`.
2. **Two or more features use it and it has no product meaning** — `shared/ui` or `shared/hooks`. Example: `PlusMinusButton`, `useDebounced`.
3. **Card chrome used by more than one feature** — `shared/cards`. Example: `CardTile`, `AddCardPanel`, `CardArtSquare`.
4. **Binder search used by collection, groups, and the public trade binder** — `shared/binder`.

Do **not** add `utils/`, `helpers/`, `common/`, `lib/`, `pages/`, or `components/`. Name the thing.

Tests sit next to the file they cover (`wantBrowser.ts` + `wantBrowser.test.ts`).

## Imports

Path alias `@/` maps to `src/` (`@/shared/cards/CardTile`). Same-feature imports may stay relative.

Each feature has a thin `index.ts`. Export only the public pages and the few components other layers need. Do not `export *`.

Rules, enforced by ESLint `boundaries` in the repository `eslint.config.mjs`:

- `shared/` must not import `features/`.
- A feature must not import another feature, except:
  - `groups` → `collection` (same binder UI)
  - `home` → `matches` and `auth`
  - `collection` → `profile` (trade binder preview) and `auth` (pending add after login)
  - `profile` → `matches` (matches on a public binder)
- `app/` and `layout/` may import features and shared.
- Query modules (`queries.ts`) may be imported across features.

`app/` and `layout/` should import feature UI from that feature’s `index.ts`, not from a deep file path.

## Data fetching

One HTTP client: `src/api/client.ts`, provided by `ApiProvider`. It attaches `Authorization: Bearer <token>` when Auth0 has a session. Public pages omit the token. Unlisted binders can pass a share token as `t`.

- **Query keys** live in `src/api/queryKeys.ts`. Mutations must invalidate those keys so screens stay in sync.
- **Hooks** live in the owning feature (`features/collection/queries.ts`, …). Shared card and group-list hooks used by `AddCardPanel` live in `shared/cards/queries.ts`. Place search lives in `src/api/places.ts`.
- Do not add a second fetch wrapper. Do not put React Query hooks back into one `api/queries.ts` file.

TanStack Query defaults (see `src/app/main.tsx`): `staleTime` 60s, one retry, no refetch on window focus. Card data changes at most once a day.

## Auth and shell

`AppLayout` owns the bar, phone drawer, login/logout, and the `/welcome` gate. A signed-in user without a username is sent to `/welcome` and then back to the page they aimed for.

A card picked on the landing page before sign-up is stored by `features/auth/pendingAdd.ts`. After onboarding, the collection page consumes it.

Auth0 uses `cacheLocation="localstorage"` and refresh tokens so a page refresh on a share link does not force a new login.

## Layout and copy

Write styles for a phone first. Use `sm` and `md` only to add space on a wider window.

- Rows of buttons, fields, or bar items must wrap or stack.
- Titles, binder names, and usernames must wrap or shorten. Do not give them a fixed width.
- Do not shrink a tap target so a row fits.
- Do not add helper sentences under a section title. The title, controls, and data must be enough.

The owner checks the screen in a browser. Do not open a browser to verify layout.

## Routes

Defined in `src/app/App.tsx`:

| Path                                                                                    | Screen                           |
| --------------------------------------------------------------------------------------- | -------------------------------- |
| `/`                                                                                     | Home, or landing when signed out |
| `/welcome`                                                                              | Username and city                |
| `/collection`, `/collection/cards`, `/collection/import`                                | Collection                       |
| `/groups/:groupId`                                                                      | One private group                |
| `/wants`, `/wants/all`, `/wants/:listId`, `/wants/import`                               | Wants                            |
| `/matches`                                                                              | Matches                          |
| `/trades`, `/trades/past`, `/trades/:tradeId`                                           | Trades                           |
| `/u/:handle`, `/u/:handle/trade-binder`, `/u/:handle/followers`, `/u/:handle/following` | Public profile                   |
| `/u/:handle/wants/all`, `/u/:handle/wants/:slug`                                        | Shared wants                     |
| `/binders`, `/binders/all`, `/u/:handle/all`                                            | Redirects                        |

Nav treats `/groups` as part of collection.

## Tests

Vitest + Testing Library. Web tests are the `web` project in the root `vitest.config.mts` (`jsdom`, setup file `src/test/setup.ts`).

Playwright lives in `/e2e`, not here. Public tests hit `/` and an unknown route. Authenticated tests need `E2E_AUTH0_EMAIL` and `E2E_AUTH0_PASSWORD` at the repository root.

## Related docs

- [Root README](../../README.md) — clone, database, Auth0, ship process
- [docs/monorepo.md](../../docs/monorepo.md) — workspace packages and the same folder rules
- [docs/auth0-development.md](../../docs/auth0-development.md) — SPA application settings
