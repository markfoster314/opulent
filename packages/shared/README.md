# @opulent/shared

Zod objects shared by the API and the web app. Install and run from the repo root. Not a standalone package.

The API validates requests with these objects. The web app uses the same types. There is no build step.

| File        | Contract                                |
| ----------- | --------------------------------------- |
| `user.ts`   | Usernames, profiles, reserved names     |
| `binder.ts` | Collection rows and groups              |
| `card.ts`   | Printings and prices                    |
| `want.ts`   | Wants and match keys                    |
| `trade.ts`  | Trade size limits                       |
| `import.ts` | CSV import, including the character cap |
| `errors.ts` | API error codes                         |

```bash
pnpm --filter @opulent/shared typecheck
pnpm test
```

`pnpm test` runs the Vitest project `shared`. Lint and format are root commands. Repo map: [README.md](../../README.md).
