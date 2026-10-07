# Opulent Tutor — Technical Design and Roadmap

**Opulent Tutor is a website where Magic: The Gathering players list the cards they will trade, share that list with one link, and instantly see which of those cards their friends are hunting for.**

This document holds the plan, the reasons behind each choice, and the build order. A mobile app comes later; the MVP is web only.

---

## 1. What the product does

Three things, in order of importance:

1. A user builds a **binder**: the cards they are willing to trade.
2. A user **shares** that binder with one link.
3. A visitor sees the **overlap** between their own want list and the binder in front of them.

Item 3 is the product. Items 1 and 2 only exist to make item 3 possible. If a decision helps item 3, take it. If it does not, delay it.

---

## 2. Decisions and the reasons for them

### 2.1 Language: TypeScript

The website is React, which is TypeScript. Making the backend TypeScript too means the card and binder shapes are written **once** and both sides use them.

Think of one set of measuring cups for the whole kitchen. Two languages means two sets of cups, and somebody must keep them matched by hand.

Alternatives and why not:

- **Python** works well, but the shared types are lost.
- **Go** runs faster, but builds slower for a small team.
- **Java** is too heavy for a seven-table product.

### 2.2 Architecture: one service, clean rooms inside

**Use a modular monolith. Do not use microservices yet.**

Picture one kitchen with labeled stations: salad, grill, dessert. Microservices are five separate food trucks instead. Five trucks need five sets of keys, five generators, and radios so they can talk. That is a lot of work for one cook.

The service has one folder per module:

```
users  cards  binders  wants  health   (trades comes later)
```

**The rule that keeps this cheap to split later:** a module may call another module only through an exported function. A module must never read another module's tables directly. Follow that rule and any module can be lifted into its own service without a rewrite.

### 2.3 Database: PostgreSQL

The core question the site must answer is _"which cards on my want list are in your binder?"_ That is a comparison of two lists, and PostgreSQL answers it in one query.

A key-value database such as DynamoDB is a warehouse of labeled boxes. It is very fast when you know the exact box label. It is bad at "compare these two lists", because it cannot see inside the other boxes.

PostgreSQL also brings two free bonuses:

- A `jsonb` column type, so the whole raw Scryfall record lives in one column and no schema work is needed for all 80 card fields.
- The `pg_trgm` extension, so "lighning bolt" still finds "Lightning Bolt".

**Which PostgreSQL:** Amazon RDS for PostgreSQL on the smallest instance, about 12 to 15 US dollars a month. Aurora Serverless v2 is the fancier option, but its floor is near 43 US dollars a month, which is wasted money at zero users. Move to Aurora only if traffic becomes spiky.

### 2.4 Card data: keep our own copy

**This is the most important decision in the whole design. Never call Scryfall during a user request.**

Bad way: a visitor opens a binder of 400 cards, and the server makes 400 calls to Scryfall. The page is slow and Scryfall blocks the project.

Good way: copy the phone book once a night, then every lookup is local.

The nightly job, in four steps:

1. A timer fires once a day (Amazon EventBridge Scheduler, 06:00 UTC).
2. The job asks `https://api.scryfall.com/bulk-data` which file is current.
3. The job streams the gzipped JSONL file, one card per line.
4. The job upserts rows into the local `cards` table in batches of 500.

**Why the job runs on AWS Fargate and not Lambda:** the file is about 80 MB compressed and holds roughly 100,000 cards. Lambda stops any job after 15 minutes. Fargate has no such stopwatch.

**Why streaming:** the expanded file is far larger than the compressed size. Nothing is ever held whole in memory and nothing is written to disk.

Card pictures are **hotlinked** from Scryfall's own servers. We never copy images.

### 2.5 Compute: one Lambda behind API Gateway

Lambda is a light with a motion sensor: no visitors means no running server and almost no bill. That matters a great deal in month one.

- The whole API lives in **one** Lambda function. This pattern is sometimes called a "lambdalith".
- Amazon API Gateway is the front door.
- Because the inside is a plain web app built on Hono, moving to Fargate later is a one-file change.

**One trap you must know about.** Lambda and PostgreSQL do not get along by default. Each warm Lambda copy opens its own database connection, and the database runs out of them. Two fixes are already in place:

- **Amazon RDS Proxy** holds one shared pool and hands connections out.
- The client is configured with `max: 1` and `prepare: false`, because the proxy may route the next query to a different backend session.

### 2.6 Auth: Auth0

Auth0 is the bouncer at the door. It checks identity and stamps the visitor's hand. The stamp is a JWT, a JSON Web Token.

1. React logs the user in with `@auth0/auth0-react`.
2. React sends the stamp on every request as an `Authorization` header.
3. API Gateway checks the stamp before our code runs.
4. Our code reads the `sub` claim, which is the permanent Auth0 user ID, and finds or creates the matching `users` row.

We never store a password. **Auth0 owns identity; we own the profile.**

The user row is created on the first authenticated request rather than by a signup webhook. This removes any window in which a logged-in user has no row.

### 2.7 Secrets

The database password is **never** placed in an environment variable or a CloudFormation template. The stack passes a secret ARN and a host name instead, and the password is fetched from AWS Secrets Manager on the first request after a cold start. The result is cached for the life of the process.

---

## 3. How the pieces fit together

```
                 Browser (React + MUI)
                    |            |
         Auth0 <----+            | HTTPS
    (sign in,                    |
     hand stamp)                 v
                        Amazon CloudFront  ---> Amazon S3  (static site files)
                                 |
                                 v
                        Amazon API Gateway  (checks the hand stamp)
                                 |
                                 v
                        AWS Lambda  "the whole API"
                          users | cards | binders | wants
                                 |
                                 v
                         Amazon RDS Proxy  (shares connections)
                                 |
                                 v
                      Amazon RDS for PostgreSQL
                                 ^
                                 |  nightly batch upsert
                        AWS Fargate task  "card-sync"
                                 ^
                                 |  gzipped JSONL, streamed
                          api.scryfall.com/bulk-data
```

---

## 4. Data model

Seven tables carry the whole product. The first six are in use; `trades` and `trade_items` are built but unused until Phase 7.

| Table          | Holds                                       | Key detail                                             |
| -------------- | ------------------------------------------- | ------------------------------------------------------ |
| `users`        | One row per person                          | `auth0_sub` is the only link to Auth0                  |
| `cards`        | Local Scryfall mirror, one row per printing | `raw` keeps the untouched card object                  |
| `binders`      | A named, shareable list                     | `share_token` is a secret second door                  |
| `binder_items` | One stack of cards in a binder              | Same card in a different condition is a separate stack |
| `want_items`   | What a user is hunting                      | Keyed on `oracle_id`, not a printing                   |
| `trades`       | A proposed swap (Phase 7)                   | —                                                      |
| `trade_items`  | The cards in a swap (Phase 7)               | —                                                      |

### The `scryfall_id` and `oracle_id` split

This is the one modelling idea worth reading twice.

- A **`scryfall_id`** is one exact printing. The Lightning Bolt from a specific set, with a specific picture and collector number.
- An **`oracle_id`** is the card concept, shared by every printing of it.

Binders hold **printings**, because what you physically own is one specific card. Want lists hold **concepts**, because a trader who wants Lightning Bolt almost always accepts any version of it.

That split is why the match query can join a want list to a binder at all.

### The match query

```sql
SELECT w.oracle_id, MIN(c.name), w.quantity, w.priority, SUM(bi.quantity)
FROM want_items w
JOIN cards c         ON c.oracle_id   = w.oracle_id
JOIN binder_items bi ON bi.scryfall_id = c.scryfall_id
WHERE w.user_id   = :viewer
  AND bi.binder_id = :binder
  AND bi.for_trade = true
GROUP BY w.oracle_id, w.quantity, w.priority
ORDER BY w.priority ASC
```

Read the joins as a chain: _my want_ → _every printing of that card_ → _the copies sitting in your binder_.

### Sharing

Each binder has two doors:

- A **public slug**, at `/u/:handle/:slug`, for binders set to `public`.
- A **secret share token**, passed as `?t=...`, for binders set to `unlisted`.

A `private` binder reports "not found" rather than "forbidden", so its existence is not leaked to people guessing URLs. Rotating the share token revokes every link handed out before.

---

## 5. Repository layout

```
opulentTutor/
├── apps/
│   ├── api/            Hono backend, one Lambda function
│   └── web/            React + Vite + MUI
├── packages/
│   ├── shared/         Types and validation rules used everywhere
│   └── db/             Drizzle schema, migrations, client
├── jobs/
│   └── card-sync/      Nightly Scryfall mirror refresh (Fargate)
├── infra/              AWS CDK, written in TypeScript
├── docker-compose.yml  Local PostgreSQL
└── turbo.json          Task graph
```

Tooling: **pnpm workspaces** for linking, **Turborepo** for task running and caching.

`packages/shared` and `packages/db` ship **TypeScript source**, not compiled output. Vite and esbuild compile them as part of whatever consumes them, which removes a build-ordering step entirely.

**Why this layout matters for mobile:** when React Native arrives it imports `packages/shared` and calls the same API. The split between `apps/web` and `apps/api` exists today so that tomorrow is cheap.

---

## 6. Build order

### Phase 0 — Monorepo and scaffolding — **done**

- [x] pnpm workspaces, Turborepo, shared TypeScript config, Prettier
- [x] `packages/shared` with types and Zod validation for every request shape
- [x] `packages/db` with the full Drizzle schema and generated migration
- [x] `apps/api` with Auth0 JWT middleware, error handling, and all MVP routes
- [x] `apps/web` with the dark gold theme, routing, Auth0 wiring, and API client
- [x] `jobs/card-sync` streaming importer
- [x] `infra` CDK stack: VPC, RDS, RDS Proxy, Lambda, API Gateway, Fargate schedule, S3, CloudFront
- [x] `docker-compose.yml` for local PostgreSQL
- [x] All six packages typecheck; API, web, and job all build

### Phase 1 — Get it running locally — **done**

- [x] A local PostgreSQL reachable on `localhost:5432`
- [x] `pnpm db:bootstrap` — creates the `pgcrypto` and `pg_trgm` extensions
- [x] `pnpm db:migrate` — creates the seven tables
- [x] `pnpm db:bootstrap` again — adds the fuzzy-name index, now that `cards` exists
- [x] `pnpm smoke` — 14 checks against the real database, all passing
- [ ] Confirm `GET /health/ready` reports the database as up

The smoke test is the valuable part of this phase. It drives the real service
functions rather than copies of them, and proves the four things most likely to be
wrong:

- The match query joins a want list to **every** printing of the card in a binder.
- Adding the same card twice raises the quantity, while a different condition
  starts a separate stack.
- An unlisted binder refuses a stranger but accepts a correct share token.
- Fuzzy search finds "Smoke Test Bolt" when asked for "smoke tst bolt".

### Phase 2 — Fill the card mirror — **mostly done**

- [x] `pnpm cards:sync` against local PostgreSQL
- [x] 118,517 rows in `cards`, covering 38,708 distinct card concepts
- [x] Measured: 72 seconds end to end, which is well inside the Fargate budget
- [x] 83 rows skipped, all of them objects with no `oracle_id`, exactly as designed
- [x] Fuzzy search returns Lightning Bolt for "lighning bolt" against real data
- [ ] Check that double-faced cards have a picture (162 rows have no `image_uris`; confirm these are genuinely art-less objects rather than a bug in the front-face fallback)
- [ ] Add a unit test for `toCardRow`, covering a normal card, a double-faced card, and a card with no `oracle_id`

### Phase 3 — Real Auth0 tenant

- [ ] Create an Auth0 tenant
- [ ] Create a Single Page Application for the web app
- [ ] Create an API in Auth0 with the identifier `https://api.opulenttutor.com`
- [ ] Add `http://localhost:5173` to the allowed callback, logout, and web origin lists
- [ ] Fill in `.env` from `.env.example`
- [ ] Sign in end to end and confirm a `users` row is created automatically

### Phase 4 — Binders, for real

- [ ] Create a binder, add cards, confirm quantity stacking works
- [ ] Add a binder settings screen: rename, description, visibility, rotate share token
- [ ] Wire up the "Load more" button, which currently renders but does nothing
- [ ] Add edit controls for quantity, finish, and condition on each stack
- [ ] Add a bulk paste importer, so a user can paste a decklist instead of searching 200 times

### Phase 5 — Sharing

- [ ] Confirm all three visibility modes behave correctly, including the "not found" response for private binders
- [ ] Add a copy-link button that includes the share token for unlisted binders
- [ ] Add link previews with Open Graph tags, so a shared link looks good in chat apps
- [ ] Confirm an anonymous visitor can open a public binder

### Phase 6 — Want lists and matching — **the real product**

- [ ] Confirm the match query returns correct results for a real pair of accounts
- [ ] Add an index review: measure the match query with a large want list
- [ ] Surface matches more prominently than the card wall on a shared binder page
- [ ] Add two-way matching: "what I want from you" **and** "what you want from me"
- [ ] Add rough trade value totals from the mirrored Scryfall prices

### Phase 7 — Trade proposals

- [ ] Build the API routes over the existing `trades` and `trade_items` tables
- [ ] Propose, counter, accept, decline
- [ ] Email notification on a new proposal (Amazon SES)
- [ ] A trade history page

### Phase 8 — Deploy

- [ ] `cdk bootstrap` the AWS account
- [ ] Deploy a `dev` stage and run the card sync task once by hand
- [ ] Add a GitHub Actions pipeline: typecheck, build, deploy
- [ ] Buy the domain, add an Amazon Route 53 zone and an ACM certificate
- [ ] Put a custom domain on both CloudFront and API Gateway
- [ ] Add CloudWatch alarms on Lambda errors, database connections, and card-sync failures

### Phase 9 — Mobile

- [ ] React Native app importing `packages/shared`
- [ ] Camera card scanning, which is the one feature that justifies a native app

---

## 7. Known gaps in what is built

Honest list. None of these block Phase 2.

- **Only one test, and it is a smoke test.** `pnpm smoke` covers the queries that matter, but it needs a live database and it is not a unit test suite. `toCardRow` and `slugify` are pure functions and deserve real unit tests with no database at all.
- **162 cards have no image.** Out of 118,517. Probably art-less objects such as tokens or placeholder cards, but the front-face fallback in `pickImageUris` has not been confirmed against a real double-faced card.
- **No linter.** Only Prettier and the TypeScript compiler run today. ESLint is worth adding before the team grows.
- **"Load more" does nothing.** The API returns a cursor and the button renders, but they are not connected.
- **The web bundle is one 766 kB file.** Fine for now. Split it with dynamic imports when it bothers someone.
- **One NAT gateway is a single point of failure.** It is also about 32 US dollars a month, so a second one waits until there is revenue.
- **Card migrations are not handled.** Scryfall sometimes merges or deletes card IDs and publishes a migrations feed. Until that is consumed, a `binder_items` row could point at a card that no longer exists upstream. The foreign key is `ON DELETE RESTRICT`, so no user data can vanish silently.

---

## 8. Rules we must follow

These come from the [Scryfall API documentation](https://scryfall.com/docs/api) and the Wizards of the Coast Fan Content Policy. The first one shapes the business, not just the code.

1. **Card data may not be paywalled.** Users must be able to see card data anonymously or with a free account. Charge for _our_ features — unlimited binders, trade analytics, notifications — never for the card list. This is why `GET /v1/cards/search` sits outside the auth wall.
2. **Send an accurate `User-Agent` and an `Accept` header on every request.** A library default can get the project blocked.
3. **Use the bulk files, not the per-card endpoints.** Already done.
4. **Do not alter card images.** No cropping, stretching, recolouring, or watermarking. The card tile only ever scales the whole image proportionally.
5. **Add value; do not merely repackage.** The matching feature is the value.
6. **Attribute properly.** The site footer credits Scryfall and states that Opulent Tutor is unofficial Fan Content, not produced or endorsed by Wizards of the Coast.

---

## 9. Rough running cost for the MVP

| Item                              | Monthly, US dollars    |
| --------------------------------- | ---------------------- |
| RDS PostgreSQL, smallest instance | 12 to 15               |
| NAT gateway                       | about 32               |
| Lambda and API Gateway            | under 1 at low traffic |
| S3 and CloudFront                 | 1 to 3                 |
| Fargate, one task a day           | under 2                |
| RDS Proxy                         | about 15               |
| **Total**                         | **roughly 60 to 70**   |

The NAT gateway and RDS Proxy are the two largest lines and the two easiest to remove. Dropping both brings the total near 20 US dollars a month, at the cost of putting Lambda outside the VPC and living with raw connection limits. Worth doing only if cost becomes a real problem.

---

## 10. Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Configure
cp .env.example .env     # then fill in the Auth0 values

# 4. Create extensions, tables, then indexes
pnpm db:bootstrap
pnpm db:migrate
pnpm db:bootstrap

# 5. Fill the card mirror (takes a few minutes)
pnpm cards:sync

# 6. Run everything
pnpm dev
```

The web app serves on `http://localhost:5173` and the API on `http://localhost:8787`.

---

## 11. Open questions

Worth deciding before Phase 4, not now.

- **Handles.** Users currently get a generated handle such as `mark_a1b2c3` on first login. Should they pick one during onboarding instead?
- **Condition tracking.** Is per-stack condition too much detail for an MVP? It doubles the work of adding a card. The schema supports it; the UI could default and hide it.
- **Want list size.** Is a single flat want list enough, or do people want several named lists?
- **Foil preference.** A want list currently cannot say "foil only". Adding it means a nullable finish column on `want_items`.
- **Price source.** Scryfall prices are daily estimates. Good enough for a rough total, probably not good enough to arbitrate a disputed trade.
