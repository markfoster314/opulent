# Built from the monorepo root:
#   docker build -f jobs/card-sync/Dockerfile -t opulent-card-sync .
FROM node:24-alpine AS build
WORKDIR /repo

RUN corepack enable

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY jobs/card-sync/package.json jobs/card-sync/
RUN pnpm install --frozen-lockfile=false --filter @opulent/card-sync...

COPY tsconfig.base.json ./
COPY packages ./packages
COPY jobs/card-sync ./jobs/card-sync
RUN pnpm --filter @opulent/card-sync run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/jobs/card-sync/dist/index.mjs ./index.mjs
USER node
CMD ["node", "index.mjs"]
