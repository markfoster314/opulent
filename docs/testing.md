# Testing

Three layers. Add a test only when a change can break silently. One example for that behavior is enough. Skip a test that only mirrors the implementation.

## Fast checks

`pnpm test`. Vitest. No Docker and no Auth0. The CI Quality job runs `pnpm test:coverage`.

These files cover pure behavior: Zod contracts in `packages/shared`, HTTP edges in `apps/api/src/app.test.ts`, Scryfall row mapping, price partitions, and one web behavior in `WantBinderView.test.tsx`.

Coverage under 50% prints a warning. The Quality job stays green. At or above 50% there is no warning.

## Database checks

`pnpm smoke`. `apps/api/src/smoke-test.ts` calls real services, seeds a stamp, and deletes it in `finally`. The CI Database job runs this. Do not copy those cases into Vitest.

## Browser checks

`pnpm test:e2e`. `e2e/public.spec.ts` opens the landing page and the unknown route. The authenticated spec stays off in CI until the `RUN_BROWSER_SMOKE` repository variable is `true`.

## A new test

- Name it `[outcome] when [condition]`. Leave existing names alone.
- Arrange, act, assert. Expected values are literals or fixtures. Do not compute the expected value with the function under test.
- Use `it.each` when one function has many similar inputs. Do not convert the current files.
- Mock at a seam this repo owns. The web API client in `apps/web/src/api/client.ts` and `renderWithProviders` are that seam. MSW is for `dev:mock`, not for Vitest. Do not mock Auth0, Drizzle, or jose.
- Pure functions stay pure tests. Scryfall mapping is the model: test `toCardRow`, not `fetch`.
- Browser selectors stay `getByRole` and visible text. Add `data-testid` only when the accessible name is not stable.
- Playwright waits with `expect(...).toBeVisible()`. Do not add `waitForTimeout`.
- The smoke seed is the long-lived resource. `cleanupSmoke` in `finally` is the isolation rule.
