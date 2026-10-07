# Opulent Tutor

**A website where Magic: The Gathering players list the cards they will trade, share that list with one link, and see which of those cards their friends are hunting for.**

See [ROADMAP.md](./ROADMAP.md) for the technical design, the reasons behind each choice, and the build order.

## What is in here

| Folder            | What it is                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `apps/web`        | The website. React, Vite, MUI, dark gold theme.                     |
| `apps/api`        | The backend. One Hono service, deployed as one AWS Lambda function. |
| `packages/shared` | Types and validation rules used by both sides.                      |
| `packages/db`     | PostgreSQL schema, migrations, and client. Drizzle.                 |
| `jobs/card-sync`  | Nightly job that copies all Scryfall card data into our database.   |
| `infra`           | AWS infrastructure as code. CDK, in TypeScript.                     |

## Requirements

- Node.js 24 (see `.nvmrc`; run `nvm use` to match)
- pnpm 10
- Docker, for the local PostgreSQL database

## Setup

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env     # then fill in the Auth0 values
```

Then prepare the database. The bootstrap step runs twice on purpose: the first pass creates the
PostgreSQL extensions that the tables need, and the second adds the fuzzy card-name search index,
which can only be built once the `cards` table exists.

```bash
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap
```

Check that the database works. This creates a little fake data, runs the queries the product
depends on, and cleans up after itself.

```bash
pnpm smoke
```

Fill the local card mirror. This streams about 118,000 cards from Scryfall and takes roughly 70
seconds.

```bash
pnpm cards:sync
```

## Running

```bash
pnpm dev
```

- Website: http://localhost:5173
- API: http://localhost:8787

## Common commands

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Runs the website and the API together                |
| `pnpm build`        | Builds everything                                    |
| `pnpm typecheck`    | Checks types across all packages                     |
| `pnpm smoke`        | Runs the database checks against local PostgreSQL    |
| `pnpm format`       | Formats with Prettier                                |
| `pnpm db:bootstrap` | Creates the PostgreSQL extensions and search indexes |
| `pnpm db:generate`  | Writes a new migration from schema changes           |
| `pnpm db:migrate`   | Applies pending migrations                           |
| `pnpm db:studio`    | Opens a database browser                             |
| `pnpm cards:sync`   | Refreshes the card mirror from Scryfall              |

## Deploying

```bash
pnpm build
cd infra
pnpm cdk bootstrap          # once per AWS account
pnpm deploy -- --context stage=dev
```

## Credits

Card data and images courtesy of [Scryfall](https://scryfall.com). Opulent Tutor is unofficial Fan
Content permitted under the Wizards of the Coast Fan Content Policy, and is not produced or endorsed
by Wizards of the Coast or Scryfall.
