# @opulent/devtools

Dev console for the running web app. Install and run from the repo root. Not a standalone package.

## Run

```bash
pnpm dev        # API and web
pnpm dev:tools  # opens http://localhost:5173/__dev
```

The console is a route in the web dev server, so it shares the app origin. It mounts only in dev and is absent from a production build.

## Controls

| Section   | Use                                                                        |
| --------- | -------------------------------------------------------------------------- |
| Session   | Signed out, new account, returning account, expired token, loading         |
| Network   | Mocks on or off, Ok, Empty, Slow, 401, 404, 500, Offline, Timeout, delay   |
| Endpoints | One rule per group: Inherit, Real, or any scenario                         |
| Users     | Create or remove local demo users, optionally with a viewer's wanted cards |
| Events    | Trade request, new match, price change, refetch all, clear cache           |
| Requests  | Last 20 `/v1` calls with status and Mock or Real                           |

## How it works

- State contract: `src/state.ts`, stored in `localStorage` under `ot-dev-state`.
- Transport: `BroadcastChannel` named `ot-devtools`. The console tab edits state; the app tab applies it.
- App agent: `apps/web/src/devtools/boot.ts`. It sets the session preset and starts or stops the MSW worker.
- Mock planner: `apps/web/src/mocks/plan.ts`. Endpoint rule first, then the session rule, then the global scenario.
- Demo users: `POST /__dev/users` on the local API. The database factory is `packages/db/src/demo-users.ts`.

## Safety

- The `/__dev` routes are mounted only by `apps/api/src/index.ts`, never by `lambda.ts`.
- Every dev route calls `assertLocalDatabase()` before it reads or writes.
- Demo users have a `seed|dev_` subject and the console can remove them.
- `pnpm --filter @opulent/web build` drops the console and its chunk.
