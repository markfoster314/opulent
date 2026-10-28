# @opulent/infra

AWS CDK app. One stack, `OpulentTutor-${stage}`. Install and run from the repo root. Not a standalone package.

Account `CDK_DEFAULT_ACCOUNT`. Region `CDK_DEFAULT_REGION`, or `us-east-1`. Stage from `--context stage=`, else `STAGE`, else `dev`.

## Run

`pnpm build` first. Synth and deploy read `apps/api/dist` and `apps/web/dist`.

```bash
pnpm build
pnpm --filter @opulent/infra run deploy -- \
  --context stage=dev \
  --context auth0Domain=... \
  --context auth0Audience=... \
  --context auth0ClientId=... \
  --context corsOrigin=...
```

Deploy applies the schema, then uploads the site. `/config.json` carries the API address and the Auth0 settings. CloudFront does not cache that file.

| Command                                    | Use                             |
| ------------------------------------------ | ------------------------------- |
| `pnpm --filter @opulent/infra typecheck`   | This package                    |
| `pnpm infra:synth`                         | `infra/cdk.out`                 |
| `pnpm --filter @opulent/infra run check`   | Template assertions after synth |
| `pnpm --filter @opulent/infra run diff`    | Compare the deployed stack      |
| `pnpm --filter @opulent/infra run deploy`  | Deploy                          |
| `pnpm --filter @opulent/infra run destroy` | Delete a non-prod stack         |

Lint, test, and format are root commands. Repo map: [README.md](../README.md).

## Tree

```text
bin/app.ts              stage, then the stack
bin/check-template.ts   assertions on cdk.out
lib/opulent-tutor-stack.ts
lib/stage-context.ts    dev defaults and the prod guard
```

## Stack

One zone, one NAT. RDS PostgreSQL 16 in a private subnet. The API, the schema step, and the nightly card job use the database host.

API Lambda from `apps/api/dist`. Runtime `nodejs26.x` on Graviton, 1,024 MB, 20 seconds, concurrency cap 20. The schema step uses the same runtime. Amazon lists `nodejs26.x` as a public preview. The name stays when it becomes general. Auth0 JWKS stays in the function. Gateway throttle is 20 per second, burst 20.

`MigrateFunction` runs on deploy. It applies bootstrap, Drizzle migrations from `packages/db/migrations`, then bootstrap again. The API function is created after that step.

Card sync is an ARM Fargate task at 06:00 UTC. Image from `jobs/card-sync/Dockerfile` (Node 26). Production deploy: [docs/deploy.md](../docs/deploy.md).

Alarms: API Lambda errors, database free storage under 2 GB, a card sync that does not start, and a card sync task that stops with a non-zero exit. Optional `alarmEmail` subscribes to that topic.

Web is a private S3 bucket behind CloudFront. Unknown paths return `index.html`. Deploy uploads `apps/web/dist` and invalidates the distribution.

## Stage

Dev fills laptop defaults: Auth0 domain `your-tenant.us.auth0.com`, client `your-spa-client-id`, audience `https://api.opulenttutor.com`, origin `http://localhost:5173`. Mail settings stay empty, so mail stays off.

`stage=prod` stops synth when any of these are missing or still a placeholder:

| Context         | Prod rule                                          |
| --------------- | -------------------------------------------------- |
| `auth0Domain`   | Not `your-tenant.us.auth0.com`                     |
| `auth0Audience` | Set on the command. The dev default is not enough. |
| `auth0ClientId` | Not `your-spa-client-id`                           |
| `corsOrigin`    | Set, and not localhost                             |
| `webOrigin`     | Set, `https://`, and not localhost                 |
| `emailFrom`     | Set                                                |
| `resendApiKey`  | Set                                                |
| `alarmEmail`    | Optional                                           |

`webOrigin` falls back to the first CORS origin when it is omitted. Prod still requires it on the command.

## Tests

Vitest project `infra` covers `lib/stage-context.test.ts`. It does not synth the stack. `pnpm --filter @opulent/infra run check` reads `cdk.out` after `pnpm infra:synth`. CI runs that check. CI does not deploy.
